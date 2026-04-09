import express from "express";
import WebSocket from "ws";

function buildAuthorizedWsUrl({ crypto, wsUrl, apiKey, apiSecret }) {
  const u = new URL(wsUrl);
  const host = u.host;
  const path = u.pathname;
  const date = new Date().toUTCString();

  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signatureSha = crypto.createHmac("sha256", apiSecret).update(signatureOrigin).digest("base64");
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");

  u.searchParams.set("authorization", authorization);
  u.searchParams.set("date", date);
  u.searchParams.set("host", host);
  return u.toString();
}

async function callSparkWs({ crypto, wsUrl, domain, appId, apiKey, apiSecret, messages, temperature, maxTokens }) {
  const authedUrl = buildAuthorizedWsUrl({ crypto, wsUrl, apiKey, apiSecret });

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(authedUrl);
    let done = false;
    let content = "";

    const cleanup = () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };

    ws.on("open", () => {
      const payload = {
        header: {
          app_id: String(appId),
          uid: "campus-second-hand-market",
        },
        parameter: {
          chat: {
            domain: String(domain),
            temperature: typeof temperature === "number" ? temperature : 0.7,
            max_tokens: typeof maxTokens === "number" ? maxTokens : 1024,
          },
        },
        payload: {
          message: {
            text: messages,
          },
        },
      };
      ws.send(JSON.stringify(payload));
    });

    ws.on("message", (data) => {
      try {
        const text = typeof data === "string" ? data : data.toString("utf-8");
        const msg = JSON.parse(text);
        const header = msg?.header;
        const code = Number(header?.code);
        if (Number.isFinite(code) && code !== 0) {
          done = true;
          cleanup();
          return reject(Object.assign(new Error(String(header?.message || "Spark WS error")), { upstream: header }));
        }

        const choices = msg?.payload?.choices;
        const parts = choices?.text || [];
        for (const p of parts) {
          if (p?.content) content += String(p.content);
        }

        const status = Number(header?.status ?? choices?.status);
        if (status === 2 && !done) {
          done = true;
          cleanup();
          resolve(content);
        }
      } catch (e) {
        done = true;
        cleanup();
        reject(e);
      }
    });

    ws.on("error", (err) => {
      if (done) return;
      done = true;
      cleanup();
      reject(err);
    });

    ws.on("close", () => {
      if (done) return;
      done = true;
      reject(new Error("Spark WS closed before completion"));
    });
  });
}

async function callSparkWsStream({
  crypto,
  wsUrl,
  domain,
  appId,
  apiKey,
  apiSecret,
  messages,
  temperature,
  maxTokens,
  onDelta,
}) {
  const authedUrl = buildAuthorizedWsUrl({ crypto, wsUrl, apiKey, apiSecret });

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(authedUrl);
    let done = false;
    let content = "";

    const cleanup = () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };

    ws.on("open", () => {
      const payload = {
        header: {
          app_id: String(appId),
          uid: "campus-second-hand-market",
        },
        parameter: {
          chat: {
            domain: String(domain),
            temperature: typeof temperature === "number" ? temperature : 0.7,
            max_tokens: typeof maxTokens === "number" ? maxTokens : 1024,
          },
        },
        payload: {
          message: {
            text: messages,
          },
        },
      };
      ws.send(JSON.stringify(payload));
    });

    ws.on("message", (data) => {
      try {
        const text = typeof data === "string" ? data : data.toString("utf-8");
        const msg = JSON.parse(text);
        const header = msg?.header;
        const code = Number(header?.code);
        if (Number.isFinite(code) && code !== 0) {
          done = true;
          cleanup();
          return reject(Object.assign(new Error(String(header?.message || "Spark WS error")), { upstream: header }));
        }

        const choices = msg?.payload?.choices;
        const parts = choices?.text || [];
        for (const p of parts) {
          if (p?.content) {
            const delta = String(p.content);
            content += delta;
            if (typeof onDelta === "function") onDelta(delta);
          }
        }

        const status = Number(header?.status ?? choices?.status);
        if (status === 2 && !done) {
          done = true;
          cleanup();
          resolve(content);
        }
      } catch (e) {
        done = true;
        cleanup();
        reject(e);
      }
    });

    ws.on("error", (err) => {
      if (done) return;
      done = true;
      cleanup();
      reject(err);
    });

    ws.on("close", () => {
      if (done) return;
      done = true;
      reject(new Error("Spark WS closed before completion"));
    });
  });
}

function extractFirstJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // ignore
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = raw.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      return null;
    }
  }
  return null;
}

function parseGenerateProductResult(aiResponse) {
  let estimatedPrice = "3500";
  const priceMatch = String(aiResponse || "").match(/价格[:：]\s*¥?\s*(\d+)/);
  if (priceMatch) {
    estimatedPrice = priceMatch[1].trim();
  }

  let generatedDescription = String(aiResponse || "")
    .split("\n")
    .filter((line) => !line.includes("分类") && !line.includes("成色") && !line.includes("价格"))
    .join("\n");
  generatedDescription = generatedDescription.trim();

  return {
    description: generatedDescription,
    price: estimatedPrice,
  };
}

async function getScenePrompt(db, scene) {
  try {
    const rows = await db.query(
      `SELECT name, content
       FROM ai_prompts
       WHERE scene = ? AND enabled = 1
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
      [scene]
    );
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

export function createAiRouter({ db, crypto, xfWsUrl, xfDomain, xfAppId, xfApiKey, xfApiSecret }) {
  const router = express.Router();

  // AI 生成商品描述和价格估计
  router.post("/ai/generate-product", async (req, res) => {
    try {
      const { description, images } = req.body;

      if (!description && !images) {
        return res.status(400).json({ error: "请提供商品描述或图片" });
      }

      // 构建提示词
      let prompt = `你是一个专业的二手商品描述专家，帮我为以下商品生成一个完整且简练的商品介绍，并根据市场情况估计一个合理的价格。\n\n`;

      if (description) {
        prompt += `商品描述：${description}\n\n`;
      }

      if (images && images.length > 0) {
        prompt += `商品图片：${images.length}张\n\n`;
        prompt += `请仔细分析图片内容，识别商品的类型、品牌、型号、成色等信息，并在生成的描述中体现出来。\n\n`;
      }

      prompt += `要求：\n1. 生成的描述要专业、详细，突出商品的特点和优势\n2. 描述结构清晰，包括商品特点、使用情况、转手原因、交易方式等\n3. 价格估计要合理，基于市场情况和商品状况\n4. 自动识别商品的分类和成色，并在描述中明确体现\n5. 输出格式：\n   - 分类：商品分类\n   - 成色：商品成色\n   - 描述：商品描述\n   - 价格估计：¥XXX\n\n请严格按照上述格式输出，不要添加任何其他内容。`;

      try {
        if (!xfWsUrl || !xfDomain || !xfAppId || !xfApiKey || !xfApiSecret) {
          return res.status(400).json({
            error: "科大讯飞 WebSocket 配置不完整：请设置 XF_WS_URL/XF_DOMAIN/XF_APP_ID/XF_API_KEY/XF_API_SECRET",
          });
        }

        // 构建消息内容
        const messages = [
          {
            role: "system",
            content:
              "你是一个专业的二手商品描述专家，擅长生成详细、准确的商品介绍和合理的价格估计。你能够根据商品描述和图片识别商品的类型、品牌、型号、成色等信息，并生成专业的商品描述。",
          },
          {
            role: "user",
            content: prompt,
          },
        ];

        // 如果有图片，添加图片数据
        if (images && images.length > 0) {
          images.forEach((image, index) => {
            messages.push({
              role: "user",
              content: `图片 ${index + 1}：data:image/jpeg;base64,${image}`,
            });
          });
        }

        const aiResponse = await callSparkWs({
          crypto,
          wsUrl: xfWsUrl,
          domain: xfDomain,
          appId: xfAppId,
          apiKey: xfApiKey,
          apiSecret: xfApiSecret,
          messages,
          temperature: 0.7,
          maxTokens: 1024,
        });

        res.json(parseGenerateProductResult(aiResponse));
      } catch (error) {
        console.error("科大讯飞 WS 调用失败:", error);
        return res.status(502).json({ error: "AI 生成失败（科大讯飞WS调用异常）", upstream: error?.upstream });
      }
    } catch (error) {
      console.error("AI 生成失败:", error);
      res.status(500).json({ error: "AI 生成失败，请重试" });
    }
  });

  // AI 生成商品描述和价格估计（流式）
  router.post("/ai/generate-product/stream", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const { description, images } = req.body || {};
      if (!description && !images) {
        send("error", { error: "请提供商品描述或图片" });
        return res.end();
      }

      if (!xfWsUrl || !xfDomain || !xfAppId || !xfApiKey || !xfApiSecret) {
        send("error", {
          error: "科大讯飞 WebSocket 配置不完整：请设置 XF_WS_URL/XF_DOMAIN/XF_APP_ID/XF_API_KEY/XF_API_SECRET",
        });
        return res.end();
      }

      let prompt = `你是一个专业的二手商品描述专家，帮我为以下商品生成一个完整且简练的商品介绍，并根据市场情况估计一个合理的价格。\n\n`;
      if (description) prompt += `商品描述：${description}\n\n`;
      if (images && images.length > 0) {
        prompt += `商品图片：${images.length}张\n\n`;
        prompt += `请仔细分析图片内容，识别商品的类型、品牌、型号、成色等信息，并在生成的描述中体现出来。\n\n`;
      }
      prompt += `要求：\n1. 生成的描述要专业、详细，突出商品的特点和优势\n2. 描述结构清晰，包括商品特点、使用情况、转手原因、交易方式等\n3. 价格估计要合理，基于市场情况和商品状况\n4. 自动识别商品的分类和成色，并在描述中明确体现\n5. 输出格式：\n   - 分类：商品分类\n   - 成色：商品成色\n   - 描述：商品描述\n   - 价格估计：¥XXX\n\n请严格按照上述格式输出，不要添加任何其他内容。`;

      const messages = [
        {
          role: "system",
          content:
            "你是一个专业的二手商品描述专家，擅长生成详细、准确的商品介绍和合理的价格估计。你能够根据商品描述和图片识别商品的类型、品牌、型号、成色等信息，并生成专业的商品描述。",
        },
        {
          role: "user",
          content: prompt,
        },
      ];

      if (images && images.length > 0) {
        images.forEach((image, index) => {
          messages.push({
            role: "user",
            content: `图片 ${index + 1}：data:image/jpeg;base64,${image}`,
          });
        });
      }

      send("start", { ok: true });
      const fullText = await callSparkWsStream({
        crypto,
        wsUrl: xfWsUrl,
        domain: xfDomain,
        appId: xfAppId,
        apiKey: xfApiKey,
        apiSecret: xfApiSecret,
        messages,
        temperature: 0.7,
        maxTokens: 1024,
        onDelta: (delta) => send("delta", { text: delta }),
      });

      send("done", parseGenerateProductResult(fullText));
      return res.end();
    } catch (error) {
      console.error("AI 流式生成失败:", error);
      send("error", { error: "AI 生成失败，请重试" });
      return res.end();
    }
  });

  // AI 搜索：从候选商品中返回相关性最高的 1 个
  router.post("/ai/search-top-product", async (req, res) => {
    try {
      const query = String(req.body?.query || "").trim();
      if (!query) {
        return res.status(400).json({ error: "query 不能为空" });
      }

      if (!xfWsUrl || !xfDomain || !xfAppId || !xfApiKey || !xfApiSecret) {
        return res.status(400).json({
          error: "科大讯飞 WebSocket 配置不完整：请设置 XF_WS_URL/XF_DOMAIN/XF_APP_ID/XF_API_KEY/XF_API_SECRET",
        });
      }

      const rows = await db.query(
        `SELECT p.id, p.title, p.description, p.price, p.condition, p.category_id, p.views, p.favorites, p.created_at, c.name AS category
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.status = 'approved'
         ORDER BY p.created_at DESC
         LIMIT 50`
      );

      if (!rows.length) {
        return res.json({ productId: null, reason: "暂无可推荐商品" });
      }

      const candidates = rows.map((p) => ({
        id: Number(p.id),
        title: String(p.title || ""),
        description: String(p.description || "").slice(0, 180),
        category: String(p.category || ""),
        condition: String(p.condition || ""),
        price: Number(p.price || 0),
        views: Number(p.views || 0),
        favorites: Number(p.favorites || 0),
        createdAt: p.created_at,
      }));

      const scenePrompt = await getScenePrompt(db, "search_top_product");
      if (!scenePrompt?.content) {
        return res.status(400).json({
          error:
            "未配置 AI 搜索提示词（scene=search_top_product）。请在 AI 中心新增并启用该场景提示词，支持变量 {{query}} 与 {{candidates}}。",
        });
      }
      const prompt = String(scenePrompt.content)
        .replace(/\{\{\s*query\s*\}\}/g, query)
        .replace(/\{\{\s*candidates\s*\}\}/g, JSON.stringify(candidates));

      const aiResponse = await callSparkWs({
        crypto,
        wsUrl: xfWsUrl,
        domain: xfDomain,
        appId: xfAppId,
        apiKey: xfApiKey,
        apiSecret: xfApiSecret,
        messages: [
          { role: "system", content: "你是一个严谨的 JSON 输出助手。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        maxTokens: 512,
      });

      const parsed = extractFirstJsonObject(aiResponse) || {};
      const productId = Number(parsed.productId);
      const reason = String(parsed.reason || "").trim();
      const aiReply = String(parsed.reply || reason || "").trim();

      if (!Number.isFinite(productId)) {
        return res.status(502).json({ error: "AI 未返回有效商品", raw: aiResponse });
      }

      const exists = rows.some((r) => Number(r.id) === productId);
      if (!exists) {
        return res.status(502).json({ error: "AI 返回了不在候选集中的商品", raw: aiResponse });
      }

      return res.json({
        productId,
        reason: reason || "AI 推荐最相关商品",
        aiReply: aiReply || "我已根据关键词和候选商品语义匹配，推荐了最相关的一件商品。",
        promptName: scenePrompt?.name || "default-search-top-product",
      });
    } catch (error) {
      console.error("AI 搜索推荐失败:", error);
      return res.status(500).json({ error: "AI 搜索推荐失败，请重试" });
    }
  });

  return router;
}

