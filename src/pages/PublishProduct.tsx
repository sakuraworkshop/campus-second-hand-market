import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, ImagePlus, Brain, Sparkles } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { getMe } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { resolveAssetUrl } from "@/lib/assets";
import { toast } from "sonner";

const PublishProduct = () => {
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [campus, setCampus] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // AI 帮写相关状态
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGeneratedDescription, setAiGeneratedDescription] = useState("");
  const [aiEstimatedPrice, setAiEstimatedPrice] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);

  useEffect(() => {
    // 获取分类列表
    api
      .listCategories()
      .then((rows) => {
        const allCategories = rows.map((c: any) => ({ id: c.id, name: c.name }));
        setCategories(allCategories);
      })
      .catch(() => setCategories([]));
  }, []);

  const addImageByUpload = () => {
    if (images.length >= 9 || uploadingImage) return;
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (images.length >= 9) {
      e.target.value = "";
      return;
    }
    setUploadingImage(true);
    try {
      const { path, url } = await api.ossUploadFile(file, "products");
      // 数据库存相对路径更稳（生产/开发自动适配）；兼容没有 path 的老返回
      setImages((prev) => [...prev, path || url].slice(0, 9));
    } catch (error) {
      console.error("图片上传失败:", error);
      toast.error("图片上传失败，请检查 OSS 配置后重试");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  // 实际 API 调用：AI 生成商品介绍和价格估计
  const generateAiContent = async () => {
    if (!aiInput.trim()) {
      setAiError("请输入商品描述或上传图片");
      return;
    }

    setAiLoading(true);
    setAiStreaming(true);
    setAiError("");
    setAiGeneratedDescription("");
    setAiEstimatedPrice("");

    try {
      await api.generateProductStream(
        {
          description: aiInput,
          images: images.length > 0 ? images : undefined,
        },
        {
          onDelta: (text) => {
            setAiGeneratedDescription((prev) => prev + text);
          },
          onDone: (result) => {
            setAiGeneratedDescription(result.description);
            setAiEstimatedPrice(result.price);
          },
          onError: (message) => {
            setAiError(message || "AI 生成失败，请重试");
          },
        }
      );
    } catch (error) {
      console.error("AI 生成失败:", error);
      if (!aiGeneratedDescription) {
        setAiError("AI 生成失败，请重试");
      }
    } finally {
      setAiLoading(false);
      setAiStreaming(false);
    }
  };

  // 应用 AI 生成的内容到表单
  const applyAiContent = () => {
    setTitle(aiInput); // 使用用户输入给 AI 的描述作为商品名称
    // 过滤掉包含分类、成色和价格的行
    const filteredDescription = aiGeneratedDescription.split('\n').filter(line => !line.includes('分类') && !line.includes('成色') && !line.includes('价格')).join('\n');
    setDescription(filteredDescription);
    // 自动填写价格
    setPrice(aiEstimatedPrice);
    
    setAiDialogOpen(false);
  };

  const handleSubmit = async () => {
    // 表单验证
    if (!title || !categoryId || !condition || !price || !description || !campus) {
      toast.info("请填写必填项");
      return;
    }

    const user = getMe();
    if (!user) {
      toast.info("请先登录");
      navigate("/login");
      return;
    }

    setSubmitting(true);
    try {
      await api.createProduct({
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        image_url: images[0] || "",
        images,
        condition,
        category_id: categoryId,
        campus,
        owner_id: user.id
      });
      toast.success("发布成功，已上架");
      // 重置表单
      setTitle("");
      setCategoryId("");
      setCondition("");
      setPrice("");
      setOriginalPrice("");
      setCampus("");
      setDescription("");
      setImages([]);
    } catch (error) {
      toast.error("发布失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container max-w-2xl py-4 md:py-6">
          <h1 className="text-xl font-bold text-foreground mb-6">发布闲置</h1>

          <div className="space-y-6">
            {/* Images */}
            <div className="space-y-2">
              <Label>商品图片 <span className="text-muted-foreground font-normal">（最多9张）</span></Label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {images.map((img, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border">
                    <img src={resolveAssetUrl(img)} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setImages(images.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-foreground/60 text-background flex items-center justify-center hover:bg-foreground/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {images.length < 9 && (
                  <button
                    onClick={addImageByUpload}
                    className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    disabled={uploadingImage}
                  >
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-xs">{uploadingImage ? "上传中..." : `${images.length}/9`}</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">商品名称 <span className="text-destructive">*</span></Label>
              <Input 
                id="title" 
                placeholder="请输入商品名称，如：iPad Air 5 256G 99新" 
                maxLength={50}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Category & Condition */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>商品分类 <span className="text-destructive">*</span></Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>新旧程度 <span className="text-destructive">*</span></Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger><SelectValue placeholder="选择成色" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全新">全新</SelectItem>
                    <SelectItem value="几乎全新">几乎全新</SelectItem>
                    <SelectItem value="轻微使用">轻微使用</SelectItem>
                    <SelectItem value="明显使用">明显使用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">出售价格 <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
                  <Input 
                    id="price" 
                    type="number" 
                    placeholder="0.00" 
                    className="pl-7" 
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="originalPrice">原价</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
                  <Input 
                    id="originalPrice" 
                    type="number" 
                    placeholder="0.00" 
                    className="pl-7" 
                    min={0}
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Campus */}
            <div className="space-y-2">
              <Label>交易校区 <span className="text-destructive">*</span></Label>
              <Select value={campus} onValueChange={setCampus}>
                <SelectTrigger><SelectValue placeholder="选择校区" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="东校区">东校区</SelectItem>
                  <SelectItem value="西校区">西校区</SelectItem>
                  <SelectItem value="南校区">南校区</SelectItem>
                  <SelectItem value="北校区">北校区</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="description">商品描述 <span className="text-destructive">*</span></Label>
                <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm" className="gap-1">
                      <Brain className="h-4 w-4" />
                      AI 帮写
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI 帮写商品介绍
                      </DialogTitle>
                      <DialogDescription>
                        输入商品描述或上传图片，AI 会帮你生成完整且简练的商品介绍，并根据市场情况估计价格。
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="ai-input">商品描述或图片</Label>
                        <Textarea
                          id="ai-input"
                          placeholder="描述商品的品牌、型号、使用情况等，如：iPad Air 5 256G 99新，使用3个月"
                          rows={3}
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={generateAiContent}
                        disabled={aiLoading}
                      >
                        {aiLoading ? "生成中..." : "开始生成"}
                      </Button>
                      {aiError && (
                        <div className="text-destructive text-sm">{aiError}</div>
                      )}
                      {aiGeneratedDescription && (
                        <div className="space-y-4 pt-4 border-t border-border">
                          <div className="space-y-2">
                            <Label>AI 生成的商品描述</Label>
                            <div className="relative">
                              <Textarea
                                readOnly
                                value={aiGeneratedDescription
                                  .split("\n")
                                  .filter((line) => !line.includes("分类") && !line.includes("成色") && !line.includes("价格"))
                                  .join("\n")}
                                rows={6}
                                className={aiStreaming ? "transition-opacity duration-300 opacity-95" : ""}
                              />
                              {aiStreaming && (
                                <span className="absolute right-3 bottom-3 inline-block h-4 w-[2px] bg-primary animate-pulse" />
                              )}
                            </div>
                          </div>
                          <Button
                            className="w-full gap-2"
                            onClick={applyAiContent}
                          >
                            <Sparkles className="h-4 w-4" />
                            应用到表单
                          </Button>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Textarea
                id="description"
                placeholder="描述商品的使用情况、购买时间、转手原因等，让买家更了解你的宝贝~"
                rows={5}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button variant="outline" className="flex-1">存为草稿</Button>
              <Button 
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "发布中..." : (
                  <>
                    <Upload className="h-4 w-4" /> 提交发布
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PublishProduct;
