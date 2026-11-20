// =============================================================
//  إعدادات التطبيق
// =============================================================
//  إذا تركت FIREBASE_CONFIG فارغاً (null) يشتغل التطبيق بـ "الوضع التجريبي":
//  البيانات تُحفظ على نفس الجهاز فقط، وتكدر تجرب كل الشاشات.
//
//  للتشغيل الحقيقي (كل الموظفين يرسلون للمشرف):
//  الصق هنا إعدادات مشروع Firebase مالتك (راجع ملف README.md).
// =============================================================

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDRyAiMVwlXVKPzdhcWpWJ0IsSjzLjFV4U",
  authDomain: "asphalt-pumps.firebaseapp.com",
  projectId: "asphalt-pumps",
  storageBucket: "asphalt-pumps.firebasestorage.app",
  messagingSenderId: "1028260470346",
  appId: "1:1028260470346:web:202025089ba515983150b3"
};

/* مثال بعد اللصق:
window.FIREBASE_CONFIG = {
  apiKey: "AIza....",
  authDomain: "my-pumps.firebaseapp.com",
  projectId: "my-pumps",
  storageBucket: "my-pumps.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
*/

window.APP_NAME = "مراقبة مضخات وحدة الأسفلت";
window.COMPANY_NAME = "شركة مصافي الجنوب";
