# تشغيل أول GPU لتجربة Spaktok من هاتف Android — 29 أكتوبر 2026

> دليل تنفيذ يطابق صور حساب RunPod التي أرسلها صاحب المشروع.
> **لم يُشغَّل أي Pod من جهة ChatGPT أو مستودع Spaktok.**
> **لا يوجد ضبط RunPod موثوق يضمن الإيقاف بعد ساعة واحدة في واجهة الصور.**

## 1. خيارات الشاشة قبل إنشاء أي Pod

| الحقل في RunPod | الاختيار التجريبي |
|---|---|
| GPU | 1× RTX PRO 6000 WK / 96GB، إذا بقي متوفرًا |
| GPU Count | **1** فقط |
| Instance Pricing | **On-Demand**، وليس Reserved |
| السعر | **$2.59/ساعة** كما في صورك؛ راجع السعر النهائي |
| القالب | PyTorch 2.8.0 مع CUDA 12.8؛ لفحص العتاد فقط |
| Container Disk | يُنصح مبدئيًا بـ60GB إن سمحت الميزانية |
| Persistent Volume / Global Network Volume | **لا تنشئ** تخزينًا دائمًا لتجربة قابلة للحذف |
| HTTP Ports | 8000 للنظام 3D؛ و8888 إن أردت Jupyter؛ مع تأمين الواجهة |
| مدة الاستخدام | احسب 60 دقيقة من وقت الفوترة الفعلي، ولا تعتمد على مؤقّت وهمي |

- ظهور نافذة **GPU Reservation Request / 12+ months / Talk to Sales**
  لا يعني أنك في خطة الساعة؛ أغلقها ولا تملأها.
- ظهور الاقتراح **75GB persistent storage at /workspace** لا يجبرك
  على إنشاء Volume مستقل لتجربة قصيرة؛ لكنه يعني أن 10GB قرص حاوية
  قد لا يكفي لتحميل PyTorch ونموذج Stable Fast 3D وأدوات CUDA.
- **قبل الضغط على Deploy:** تأكد من وجود طريقة عملية لحذف الـPod.
  إذا كنت ستغادر الشاشة ولا تستطيع المتابعة، لا تبدأ.
- تصدر فواتير GPU أثناء سحب صور الحاوية وتحميل النموذج وكذلك الاستدلال
  بحسب سياسة RunPod؛ ليست تكلفة إنشاء GLB وحده.
- إن كانت صور أشخاص حقيقيين ستُرسَل، اختر المنطقة الأوروبية إن توفرت
  وافحص شروط المعالجة والاحتفاظ ونقل البيانات قبل رفعها.

## 2. تصحيح أمان مالي حاسم

عكس صفحة CLI القديمة، أكّدت ملاحظات إصدار RunPod v2.12.0 أن
`--terminate-after` و`--stop-after` أُزيلا. وتقول الوثائق الأحدث
لـRunPod إن هذين الخيارين لم يُنفَّذا من المزود أصلًا؛ لذلك **لا**
تعتمد عليهما لتحديد التكاليف.

المسار الآمن للتجربة اليدوية:
1. شغّل **On-Demand** فقط وأبقِ لوحة Pods مفتوحة.
2. نفذ اختبار العتاد أولًا.
3. قبل تجاوز الساعة ادخل إلى **Pods** واضغط **Terminate**.
4. تحقق أن Pod لم يعد يظهر ضمن الموارد الفعالة، وأنه لا توجد
   Network/Global Volumes إضافية ما زالت تُحتسب.
5. **Stop** ليس مثل **Terminate**؛ فقد تبقى رسوم أقراص التخزين.
6. التنبيه على الهاتف مجرد تذكير وليس مُقفلاً آليًا للفوترة.

مصدر رسمي:
https://github.com/runpod/runpodctl/releases/tag/v2.12.0

## 3. الاختبار الأول داخل Terminal/Jupyter (بعد التشغيل فقط)

ابدأ بهذه الأوامر الخفيفة بدل تثبيت نموذج ضخم مباشرة:

```bash
nvidia-smi
python - <<'PY'
import torch
print("Torch", torch.__version__)
print("CUDA build", torch.version.cuda)
print("GPU", torch.cuda.get_device_name(0))
print("Capability", torch.cuda.get_device_capability(0))
print("Supported SM", "sm_120" in torch.cuda.get_arch_list())
print("Compute", (torch.ones(1, device="cuda") + 1).item())
PY
```

إشارات نجاح RTX PRO 6000 Blackwell:
- GPU ظاهر في nvidia-smi وPyTorch، ولا يُنفّذ على CPU فقط.
- CUDA PyTorch >= 12.8 مع `sm_120`.
- عملية Compute تطبع 2.0 بلا خطأ.

لا تتابع إلى إنشاء نموذج مدفوع إذا فشل أي بند، ولا تفترض أن تشغيل
PyTorch يثبت توافق `texture_baker` و`uv_unwrapper` لـSF3D.

## 4. ما هو جاهز في كود Spaktok، وما الذي ينقص؟

**موجود في المستودع الآن:**
- نموذج محلي `services/forge-gpu/gpu_preflight.py` لفحص توافق GPU.
- صورة CUDA12.8 تجريبية: `services/forge-gpu/Dockerfile.blackwell`.
- خادم `services/forge-gpu/server.py` بمساري `/health` و`/v1/generate`.
- عقد HMAC يسمح بتحميل الصورة وGLB مباشرة عبر HTTPS، دون تعريض
  أسرار الخادم للمتصفح أو اصطدام بحد الحمولة في Vercel.
- فحص حقوق الاستخدام، وحصة D1 اليومية، وصلاحية قصيرة للتذكرة،
  وفحص هيكل GLB بعد التوليد.

**لم ينجز أو يتحقق بعد:**
- بناء Dockerfile.blackwell واختبار CUDA extensions مع SF3D على
  بطاقة RTX PRO 6000 حقيقية.
- قبول صاحب الحساب لرخص النموذج والتنزيل من Hugging Face عند اللزوم.
- فحص URL الفعلي لـPod وفتح منفذ8000، وتكوين أسرار Vercel المحمية.
- أول توليد من صورة ثم GLB كامل بمواد صحيحة واختبار الجودة.
- التفوق على Rodin؛ لم تُنفذ مقارنة عادلة على نفس صورة المصدر.
- نشر المجسم للعموم/أفاتار Live/هدايا مدفوعة؛ هذه مراحل منفصلة.

**لا تضع أبدًا في رسائل ChatGPT أو GitHub:**
RunPod API Key، HF_TOKEN، FORGE_GPU_TOKEN، أو تفاصيل الدفع.

## 5. الروابط

- لوحة الموارد: https://console.runpod.io/pods
- إنشاء Pod: https://console.runpod.io/deploy
- Forge AI Director: https://v0-spaktok-elite-app.vercel.app/spaktok-word#ai-director
- كود التشغيل التجريبي: `scripts/runpod-forge-one-hour.sh`
  (يُظهر الخطة في dry-run فقط؛ يمنع الإطلاق المدفوع الآلي).
- المستند التقني: `docs/SPAKTOK_FORGE_DIRECT_GPU_BRIDGE_20261029.md`.

لا تضغط Deploy لمجرد أن GPU ظاهر كمتاح: الهدف هو إثبات التوافق
بأقل تكلفة، ثم الحذف المؤكد في RunPod، لا استضافة دائمة.
