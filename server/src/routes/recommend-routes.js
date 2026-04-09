import express from "express";

export function createRecommendRouter({ db, authRequired, getDb }) {
  const router = express.Router();

  // 内存缓存
  const recommendCache = new Map();
  const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5分钟

  function resolveDb() {
    // 保留兼容：优先使用 getDb() 返回的实例
    return (typeof getDb === "function" ? getDb() : null) || db;
  }

  // 记录用户浏览行为
  router.post("/recommend/record-view", authRequired, async (req, res) => {
    try {
      const { productId } = req.body;
      const userId = req.auth.uid;

      if (!productId) {
        return res.status(400).json({ error: "商品 ID 为必填" });
      }

      const activeDb = resolveDb();

      // 从数据库获取商品标签
      const productTags = await activeDb.query("SELECT tag_name FROM product_tags WHERE product_id = ?", [productId]);

      if (productTags.length === 0) {
        // 如果商品没有标签，生成默认标签
        const product = await activeDb.getById("products", productId);
        if (product) {
          // 简单的标签生成逻辑
          const title = product.title || "";
          const description = product.description || "";
          const content = `${title} ${description}`;

          // 提取关键词作为标签
          const keywords = [
            "手机",
            "平板",
            "电脑",
            "相机",
            "耳机",
            "手表",
            "教材",
            "书籍",
            "文具",
            "运动",
            "健身",
            "乐器",
            "衣服",
            "鞋子",
            "包包",
            "配件",
            "其他",
          ];

          const tags = keywords.filter((keyword) => content.includes(keyword));

          // 如果没有匹配的标签，使用默认标签
          if (tags.length === 0) {
            tags.push("其他");
          }

          // 插入商品标签
          for (const tagName of tags) {
            await activeDb.query(
              "INSERT INTO product_tags (product_id, tag_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE tag_name = VALUES(tag_name)",
              [productId, tagName]
            );
          }

          // 更新 productTags
          productTags.push(...tags.map((tagName) => ({ tag_name: tagName })));
        }
      }

      // 更新用户标签权重
      const now = new Date().toISOString();
      for (const { tag_name } of productTags) {
        await activeDb.query(
          "INSERT INTO user_tags (user_id, tag_name, weight, update_time) VALUES (?, ?, 1, ?) ON DUPLICATE KEY UPDATE weight = weight + 1, update_time = VALUES(update_time)",
          [userId, tag_name, now],
        );
      }

      res.json({ success: true, message: "浏览行为记录成功" });
    } catch (error) {
      console.error("记录浏览行为失败:", error);
      res.status(500).json({ error: "记录浏览行为失败" });
    }
  });

  // 推荐查询接口
  router.get("/recommend/:userId", async (req, res) => {
    try {
      const userId = Number(req.params.userId);

      // 检查缓存
      const cacheKey = `recommend_${userId}`;
      if (recommendCache.has(cacheKey)) {
        const cachedData = recommendCache.get(cacheKey);
        if (Date.now() - cachedData.timestamp < CACHE_EXPIRE_TIME) {
          return res.json(cachedData.data);
        }
      }

      const activeDb = resolveDb();

      // 查询预计算推荐结果
      const recommendProducts = await activeDb.query(
        "SELECT product_id, score FROM user_recommend WHERE user_id = ? ORDER BY score DESC LIMIT 10",
        [userId],
      );

      if (recommendProducts.length > 0) {
        // 批量查询商品详情
        const productIds = recommendProducts.map((item) => item.product_id);
        const products = await activeDb.query(
          `SELECT p.*, u.name as owner_name 
         FROM products p 
         LEFT JOIN users u ON p.owner_id = u.id 
         WHERE p.id IN (${productIds.map(() => "?").join(", ")}) 
         AND p.status = 'approved'`,
          productIds,
        );

        // 按推荐分数排序
        const productMap = new Map(products.map((p) => [p.id, p]));
        const sortedProducts = recommendProducts.map((item) => productMap.get(item.product_id)).filter(Boolean);

        // 缓存结果
        recommendCache.set(cacheKey, {
          data: sortedProducts,
          timestamp: Date.now(),
        });

        return res.json(sortedProducts);
      } else {
        // 兜底：返回热门商品
        const hotProducts = await activeDb.query(
          `SELECT p.*, u.name as owner_name 
         FROM products p 
         LEFT JOIN users u ON p.owner_id = u.id 
         WHERE p.status = 'approved' 
         ORDER BY p.views DESC, p.favorites DESC LIMIT 10`,
        );

        // 缓存结果
        recommendCache.set(cacheKey, {
          data: hotProducts,
          timestamp: Date.now(),
        });

        return res.json(hotProducts);
      }
    } catch (error) {
      console.error("获取推荐失败:", error);

      // 异常：返回缓存旧数据
      const cacheKey = `recommend_${req.params.userId}`;
      if (recommendCache.has(cacheKey)) {
        return res.json(recommendCache.get(cacheKey).data);
      }

      // 缓存与 DB 均不可用：返回空数组
      return res.json([]);
    }
  });

  // 定时任务：生成推荐结果
  async function generateRecommendations() {
    try {
      const activeDb = resolveDb();
      console.log("开始生成推荐结果...");

      // 获取所有用户
      const users = await activeDb.query("SELECT id FROM users");

      for (const user of users) {
        const userId = user.id;

        // 获取用户标签权重
        const userTags = await activeDb.query(
          "SELECT tag_name, weight FROM user_tags WHERE user_id = ? ORDER BY weight DESC",
          [userId],
        );

        if (userTags.length > 0) {
          // 构建用户兴趣向量
          const userInterest = new Map();
          userTags.forEach((tag) => {
            userInterest.set(tag.tag_name, tag.weight);
          });

          // 获取所有商品及其标签
          const products = await activeDb.query('SELECT id FROM products WHERE status = "approved"');

          const recommendations = [];

          for (const product of products) {
            const productId = product.id;

            // 获取商品标签
            const productTags = await activeDb.query("SELECT tag_name FROM product_tags WHERE product_id = ?", [productId]);

            if (productTags.length > 0) {
              // 计算商品与用户兴趣的匹配度
              let score = 0;
              let totalWeight = 0;

              productTags.forEach((tag) => {
                const weight = userInterest.get(tag.tag_name) || 0;
                score += weight;
                totalWeight += 1;
              });

              if (totalWeight > 0) {
                score = score / totalWeight;
                recommendations.push({ productId, score });
              }
            }
          }

          // 按分数排序，取前 10 个
          recommendations.sort((a, b) => b.score - a.score);
          const topRecommendations = recommendations.slice(0, 10);

          // 清空旧推荐结果
          await activeDb.query("DELETE FROM user_recommend WHERE user_id = ?", [userId]);

          // 插入新推荐结果
          const now = new Date().toISOString();
          for (const rec of topRecommendations) {
            await activeDb.query("INSERT INTO user_recommend (user_id, product_id, score, create_time) VALUES (?, ?, ?, ?)", [
              userId,
              rec.productId,
              rec.score,
              now,
            ]);
          }
        }
      }

      console.log("推荐结果生成完成");
    } catch (error) {
      console.error("生成推荐结果失败:", error);
    }
  }

  // 启动定时任务（每天凌晨 2:00 执行）
  function scheduleGenerateRecommendations() {
    const now = new Date();
    const scheduledTime = new Date(now);
    scheduledTime.setHours(2, 0, 0, 0);

    if (scheduledTime < now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const delay = scheduledTime - now;

    setTimeout(() => {
      generateRecommendations();
      // 每天执行一次
      setInterval(generateRecommendations, 24 * 60 * 60 * 1000);
    }, delay);
  }

  // 测试页面
  router.get("/recommend-test", (_req, res) => {
    res.send(`
    <html>
      <head>
        <title>推荐系统测试</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          input { margin: 5px; padding: 8px; }
          button { margin: 5px; padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
          button:hover { background: #0069d9; }
          #result { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>推荐系统测试</h1>
        
        <div class="test-section">
          <h2>1. 记录浏览行为</h2>
          <input type="number" id="userId" placeholder="用户 ID">
          <input type="number" id="productId" placeholder="商品 ID">
          <button onclick="recordView()">记录浏览</button>
        </div>
        
        <div class="test-section">
          <h2>2. 获取推荐</h2>
          <input type="number" id="recommendUserId" placeholder="用户 ID">
          <button onclick="getRecommend()">获取推荐</button>
        </div>
        
        <div class="test-section">
          <h2>3. 手动生成推荐</h2>
          <button onclick="generateRecommend()">生成推荐</button>
        </div>
        
        <div id="result"></div>
        
        <script>
          async function recordView() {
            const productId = document.getElementById('productId').value;
            
            const response = await fetch('/api/recommend/record-view', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer demo-token'
              },
              body: JSON.stringify({ productId: parseInt(productId) })
            });
            
            const result = await response.json();
            document.getElementById('result').innerHTML = JSON.stringify(result, null, 2);
          }
          
          async function getRecommend() {
            const userId = document.getElementById('recommendUserId').value;
            const response = await fetch('/api/recommend/' + userId);
            const result = await response.json();
            document.getElementById('result').innerHTML = JSON.stringify(result, null, 2);
          }
          
          async function generateRecommend() {
            document.getElementById('result').innerHTML = '推荐生成任务已启动，请查看服务器日志';
          }
        </script>
      </body>
    </html>
  `);
  });

  scheduleGenerateRecommendations();

  return router;
}

