document.addEventListener("DOMContentLoaded", () => {
    
    let adminToken = localStorage.getItem("adminToken") || null;
    
    const loginView = document.getElementById("loginView");
    const dashboardView = document.getElementById("dashboardView");
    const adminPass = document.getElementById("adminPass");
    const adminLoginBtn = document.getElementById("adminLoginBtn");
    const adminLogoutBtn = document.getElementById("adminLogoutBtn");
    
    const totalUsers = document.getElementById("totalUsers");
    const customPassUsers = document.getElementById("customPassUsers");
    const tableBody = document.getElementById("tableBody");

    function checkAuth() {
        if (adminToken) {
            loginView.classList.add("hidden");
            dashboardView.classList.remove("hidden");
            adminLogoutBtn.classList.remove("hidden");
            loadUsers();
        } else {
            loginView.classList.remove("hidden");
            dashboardView.classList.add("hidden");
            adminLogoutBtn.classList.add("hidden");
        }
    }

    adminLoginBtn.addEventListener("click", () => {
        const pass = adminPass.value;
        if(!pass) return;

        // Offline simulated login (Hardcoded to admin123)
        if(pass === "admin123") {
            adminToken = "simulated_local_token";
            localStorage.setItem("adminToken", adminToken);
            checkAuth();
        } else {
            alert("كلمة المرور خاطئة!");
        }
    });

    adminPass.addEventListener("keypress", (e) => {
        if(e.key === "Enter") adminLoginBtn.click();
    });

    adminLogoutBtn.addEventListener("click", () => {
        adminToken = null;
        localStorage.removeItem("adminToken");
        checkAuth();
    });

    async function loadUsers() {
        if(!adminToken) return;
        
        try {
            // Load from simulated local database
            const dbText = localStorage.getItem("adminTrackerDB") || "[]";
            let users = JSON.parse(dbText);

            users = users.sort((a,b) => b.id - a.id);
            totalUsers.textContent = users.length;
            customPassUsers.textContent = users.filter(u => u.has_custom_password).length;

            tableBody.innerHTML = "";
            users.forEach((u, index) => {
                const date = new Date(u.created_at).toLocaleString('ar-EG');
                const lockIcon = u.has_custom_password ? '<i class="fa-solid fa-lock" style="color:#10b981;"></i> محمية' : '<i class="fa-solid fa-unlock" style="color:var(--text-muted);"></i> عشوائية';
                
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td style="direction:ltr; text-align:left;">${u.email}</td>
                    <td>${lockIcon}</td>
                    <td style="direction:ltr; text-align:left;">${date}</td>
                `;
                tableBody.appendChild(tr);
            });
        } catch(e) {
            console.error(e);
        }
    }

    // Init
    checkAuth();
});
