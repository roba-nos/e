console.log("Nebula Auth Script Loading...");

// Access global auth/db from firebase-config.js (loaded before this script)
document.addEventListener("DOMContentLoaded", () => {
    console.log("Nebula Auth DOM Ready.");

    // Check if Firebase is available
    if (typeof firebase === "undefined" || typeof auth === "undefined") {
        console.error("Firebase not loaded correctly.");
        return;
    }

    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("User already logged in:", user.email);
            window.location.href = "dashboard.html";
        }
    });

    // Elements
    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const loginView = document.getElementById("loginView");
    const registerView = document.getElementById("registerView");
    const forgotView = document.getElementById("forgotView");
    const mainAuthTabs = document.getElementById("mainAuthTabs");
    const forgotPassTrigger = document.getElementById("forgotPassTrigger");
    const backToLogin = document.getElementById("backToLogin");

    // Form Fields
    const loginEmail = document.getElementById("loginEmail");
    const loginPassword = document.getElementById("loginPassword");
    const submitLoginBtn = document.getElementById("submitLoginBtn");
    const regFullName = document.getElementById("regFullName");
    const regPlatformEmail = document.getElementById("regPlatformEmail");
    const regPlatformPassword = document.getElementById("regPlatformPassword");
    const submitRegBtn = document.getElementById("submitRegBtn");

    // --- View Swicher ---
    function switchView(view) {
        if(!loginView || !registerView || !forgotView) return;
        loginView.classList.remove("active");
        registerView.classList.remove("active");
        forgotView.classList.remove("active");
        if(tabLogin) tabLogin.classList.remove("active");
        if(tabRegister) tabRegister.classList.remove("active");
        if(mainAuthTabs) mainAuthTabs.style.display = "grid";

        if(view === "login") {
            loginView.classList.add("active");
            if(tabLogin) tabLogin.classList.add("active");
        } else if(view === "register") {
            registerView.classList.add("active");
            if(tabRegister) tabRegister.classList.add("active");
        } else if(view === "forgot") {
            forgotView.classList.add("active");
            if(mainAuthTabs) mainAuthTabs.style.display = "none";
        }
    }

    if(tabLogin) tabLogin.onclick = () => switchView("login");
    if(tabRegister) tabRegister.onclick = () => switchView("register");
    if(forgotPassTrigger) forgotPassTrigger.onclick = (e) => { e.preventDefault(); switchView("forgot"); };
    if(backToLogin) backToLogin.onclick = (e) => { e.preventDefault(); switchView("login"); };

    // --- Actions ---
    if (submitLoginBtn) {
        submitLoginBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            console.log("Login button clicked");
            const email = loginEmail.value.trim();
            const password = loginPassword.value;

            if (!email || !password) {
                alert("يرجى إدخال البريد وكلمة المرور");
                return;
            }

            submitLoginBtn.disabled = true;
            submitLoginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الدخول...';

            try {
                await auth.signInWithEmailAndPassword(email, password);
                localStorage.setItem("activePlatformUser", email);
                window.location.href = "dashboard.html";
            } catch (error) {
                console.error("Login Error:", error);
                let errorMsg = "تأكد من بياناتك وحاول مجدداً";
                if(error.code === "auth/user-not-found") errorMsg = "هذا البريد غير مسجل";
                if(error.code === "auth/wrong-password") errorMsg = "كلمة المرور غير صحيحة";
                
                alert("خطأ في الدخول: " + errorMsg);
                submitLoginBtn.disabled = false;
                submitLoginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> دخول إلى حسابي';
            }
        });
    }

    if (submitRegBtn) {
        submitRegBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            console.log("Register button clicked");
            const name = regFullName.value.trim();
            const email = regPlatformEmail.value.trim();
            const password = regPlatformPassword.value;

            if (!name || !email || !password) {
                alert("يرجى إدخال كافة البيانات");
                return;
            }

            submitRegBtn.disabled = true;
            submitRegBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإنشاء...';

            try {
                const credential = await auth.createUserWithEmailAndPassword(email, password);
                await db.collection("users").doc(credential.user.uid).set({
                    name, email, createdAt: new Date().toISOString(), saved_emails: []
                });
                localStorage.setItem("activePlatformUser", email);
                window.location.href = "dashboard.html";
            } catch (error) {
                console.error("Reg Error:", error);
                alert("خطأ في الإنشاء: " + error.message);
                submitRegBtn.disabled = false;
                submitRegBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> إنشاء عضوية Nebula';
            }
        });
    }
});
