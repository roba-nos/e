console.log("Nebula Dashboard Script Loading...");

document.addEventListener("DOMContentLoaded", () => {
    console.log("Nebula Dashboard DOM Ready.");
    const API_BASE = "https://api.mail.gw";
    let currentUserData = null;
    let userId = null;

    if (typeof firebase === "undefined" || typeof auth === "undefined") {
        console.error("Firebase not loaded correctly in Dashboard.");
        return;
    }

    // --- DOM Elements ---
    const profileEmailDisplay = document.getElementById("profileEmailDisplay");
    const userAvatar = document.getElementById("userAvatar");
    const statTotalEmails = document.getElementById("statTotalEmails");
    const navLogoutProfileBtn = document.getElementById("navLogoutProfileBtn");
    const dashCustomName = document.getElementById("dashCustomName");
    const dashDomainSelector = document.getElementById("dashDomainSelector");
    const dashCreateBtn = document.getElementById("dashCreateBtn");
    const emailsGrid = document.getElementById("emailsGrid");
    const openCreatorBtn = document.getElementById("openCreatorBtn");
    const closeCreatorBtn = document.getElementById("closeCreatorBtn");
    const creatorModal = document.getElementById("creatorModal");

    const fullInbox = document.getElementById("fullInbox");
    const closeInboxBtn = document.getElementById("closeInboxBtn");
    const activeInboxTitle = document.getElementById("activeInboxTitle");
    const inboxMessagesList = document.getElementById("inboxMessagesList");
    const msgViewerPlaceholder = document.getElementById("msgViewerPlaceholder");
    const msgViewContent = document.getElementById("msgViewContent");
    const msgViewSubject = document.getElementById("msgViewSubject");
    const msgViewSender = document.getElementById("msgViewSender");
    const msgViewDate = document.getElementById("msgViewDate");
    const msgViewFrame = document.getElementById("msgViewFrame");

    // NEW Custom Modals Elements
    const aliasModal = document.getElementById("aliasModal");
    const closeAliasBtn = document.getElementById("closeAliasBtn");
    const aliasInput = document.getElementById("aliasInput");
    const saveAliasBtn = document.getElementById("saveAliasBtn");

    const confirmDeleteModal = document.getElementById("confirmDeleteModal");
    const closeConfirmDeleteBtn = document.getElementById("closeConfirmDeleteBtn");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const actionDeleteBtn = document.getElementById("actionDeleteBtn");
    const deleteConfirmText = document.getElementById("deleteConfirmText");

    // State
    let activeToken = null;
    let activeAccountId = null;
    let refreshInterval = null;
    let pendingActionAccount = null; // Stores account object for alias/delete

    // --- Firebase Auth Observer ---
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = "auth.html";
            return;
        }
        userId = user.uid;
        db.collection("users").doc(userId).onSnapshot((docSnap) => {
            if (docSnap.exists) {
                currentUserData = docSnap.data();
                updateProfileUI();
                renderEmailsGrid();
            }
        });
    });

    function updateProfileUI() {
        if (!currentUserData || !profileEmailDisplay) return;
        const email = currentUserData.email || firebase.auth().currentUser?.email || "عضو Nebula";
        profileEmailDisplay.textContent = email;
        const displayName = currentUserData.name || (email.includes('@') ? email.split('@')[0] : email);
        if (userAvatar) userAvatar.src = `https://ui-avatars.com/api/?name=${displayName}&background=6366f1&color=fff`;
    }

    if (navLogoutProfileBtn) {
        navLogoutProfileBtn.addEventListener("click", () => {
            auth.signOut().then(() => {
                localStorage.removeItem("activePlatformUser");
                window.location.href = "auth.html";
            });
        });
    }

    async function fetchDomains() {
        if (!dashDomainSelector) return;
        try {
            const res = await fetch(`${API_BASE}/domains`);
            const data = await res.json();
            if (data['hydra:member']) {
                dashDomainSelector.innerHTML = '';
                data['hydra:member'].forEach(d => {
                    const opt = document.createElement("option");
                    opt.value = "@" + d.domain;
                    opt.textContent = "@" + d.domain;
                    dashDomainSelector.appendChild(opt);
                });
            }
        } catch (e) { console.error(e); }
    }

    function renderEmailsGrid() {
        if (!emailsGrid) return;
        emailsGrid.innerHTML = "";
        const emails = currentUserData?.saved_emails || [];
        if (statTotalEmails) statTotalEmails.textContent = emails.length;

        if (emails.length === 0) {
            emailsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding: 50px; opacity: 0.5;">
                   <i class="fa-solid fa-folder-open" style="font-size: 40px; margin-bottom: 15px;"></i>
                   <p>لم تقم بحجز أي إيميل مخصص بعد.</p>
                </div>
            `;
            return;
        }

        emails.forEach(acc => {
            const card = document.createElement("div");
            card.className = "email-card glass-panel";
            const displayTitle = acc.alias || acc.address;
            const isAliasSet = !!acc.alias;

            card.innerHTML = `
                <div class="card-header">
                    <span class="card-tag">نشط</span>
                    <div class="card-actions">
                        <button class="action-btn-mini edit-btn" title="تعديل اللقب">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="action-btn-mini delete-btn" title="حذف">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                <div class="card-address-wrapper">
                    <div style="display:flex; justify-content: space-between; align-items: flex-start;">
                        <div class="card-title">${displayTitle}</div>
                        <div class="msg-count-badge" id="count-${acc.id}">..</div>
                    </div>
                    <div class="card-address" style="font-size: ${isAliasSet ? '13px' : '15px'}; opacity: ${isAliasSet ? '0.7' : '1'}">${acc.address}</div>
                </div>
                <div class="card-footer">
                    <span><i class="fa-solid fa-cloud-check" style="color:var(--primary-color)"></i> مزامن سحابياً</span>
                    <button class="btn-icon-only small-btn" style="width:32px; height:32px; font-size:12px;" onclick="event.stopPropagation(); navigator.clipboard.writeText('${acc.address}'); alert('تم النسخ');">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            `;
            card.addEventListener("click", () => openInboxFlow(acc.address, acc.token, acc.id));
            
            // Background count fetch
            updateCardMessageCount(acc.id, acc.token);

            card.querySelector(".delete-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                openDeleteConfirm(acc);
            });

            card.querySelector(".edit-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                openAliasEdit(acc);
            });

            emailsGrid.appendChild(card);
        });
    }

    async function updateCardMessageCount(id, token) {
        const badge = document.getElementById(`count-${id}`);
        if (!badge || !token) return;
        try {
            // Add a cache-buster timestamp
            const ts = new Date().getTime();
            const res = await fetch(`${API_BASE}/messages?_ts=${ts}`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            
            if (!res.ok) throw new Error("FetchFail");
            
            const data = await res.json();
            // In Mail.gw, totalItems tells us how many messages total
            const count = data['hydra:totalItems'] !== undefined ? data['hydra:totalItems'] : 0;
            
            badge.textContent = count > 99 ? "99+" : count;
            if (count > 0) {
                badge.classList.add("pulse-glow"); 
                badge.style.opacity = "1";
            } else {
                badge.classList.remove("pulse-glow");
                badge.style.opacity = "0.3"; 
            }
        } catch(e) { 
            console.error("Count fetch failed for ID:", id, e);
            badge.textContent = "0"; // Default to 0 on fail to avoid ".."
            badge.style.opacity = "0.3";
        }
    }

    // --- Custom Action Logic ---
    function openAliasEdit(acc) {
        pendingActionAccount = acc;
        aliasInput.value = acc.alias || "";
        aliasModal.classList.remove("hidden");
        aliasInput.focus();
    }

    function openDeleteConfirm(acc) {
        pendingActionAccount = acc;
        deleteConfirmText.innerHTML = `سيتم حذف البريد <strong>${acc.address}</strong> نهائياً من حسابك السحابي. لا يمكن التراجع عن هذه الخطوة.`;
        confirmDeleteModal.classList.remove("hidden");
    }

    saveAliasBtn.addEventListener("click", async () => {
        const newAlias = aliasInput.value.trim();
        if (!pendingActionAccount) return;

        saveAliasBtn.disabled = true;
        saveAliasBtn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> جاري الحفظ...";

        try {
            const userRef = db.collection("users").doc(userId);
            const docSnap = await userRef.get();
            if (docSnap.exists) {
                const updatedList = docSnap.data().saved_emails.map(item => {
                    if (item.address === pendingActionAccount.address) {
                        return { ...item, alias: newAlias };
                    }
                    return item;
                });
                await userRef.update({ saved_emails: updatedList });
                aliasModal.classList.add("hidden");
            }
        } catch (e) {
            console.error(e);
            alert("خطأ في الحفظ");
        } finally {
            saveAliasBtn.disabled = false;
            saveAliasBtn.innerHTML = "<i class='fa-solid fa-floppy-disk'></i> حفظ اللقب الجديد";
        }
    });

    actionDeleteBtn.addEventListener("click", async () => {
        if (!pendingActionAccount) return;

        actionDeleteBtn.disabled = true;
        actionDeleteBtn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> جاري الحذف...";

        try {
            const userRef = db.collection("users").doc(userId);
            await userRef.update({
                saved_emails: firebase.firestore.FieldValue.arrayRemove(pendingActionAccount)
            });
            confirmDeleteModal.classList.add("hidden");
        } catch (e) {
            console.error(e);
            alert("خطأ في الحذف");
        } finally {
            actionDeleteBtn.disabled = false;
            actionDeleteBtn.innerHTML = "نعم، احذف الآن";
        }
    });

    // Close Modals
    [closeAliasBtn, closeConfirmDeleteBtn, cancelDeleteBtn].forEach(btn => {
        btn.addEventListener("click", () => {
            aliasModal.classList.add("hidden");
            confirmDeleteModal.classList.add("hidden");
        });
    });

    // --- Creator Logic ---
    if (openCreatorBtn) {
        openCreatorBtn.addEventListener("click", () => {
            if (creatorModal) creatorModal.classList.remove("hidden");
            fetchDomains();
        });
    }
    if (closeCreatorBtn) {
        closeCreatorBtn.addEventListener("click", () => {
            if (creatorModal) creatorModal.classList.add("hidden");
        });
    }

    if (dashCreateBtn) {
        dashCreateBtn.addEventListener("click", async () => {
            let username = dashCustomName.value.trim().toLowerCase().replace(/[^a-z0-9\.\-_]/g, '');
            const domain = dashDomainSelector.value.replace('@', '');
            if (!username) username = Math.random().toString(36).substring(2, 10);

            const newEmail = `${username}@${domain}`;
            const newPassword = Math.random().toString(36) + "!";

            dashCreateBtn.disabled = true;
            dashCreateBtn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> جاري الحجز...";

            try {
                const accRes = await fetch(`${API_BASE}/accounts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: newEmail, password: newPassword })
                });

                if (!accRes.ok && accRes.status !== 422) throw new Error("AccFail");

                const tokRes = await fetch(`${API_BASE}/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: newEmail, password: newPassword })
                });

                if (!tokRes.ok) throw new Error("NAME_TAKEN");
                const tokData = await tokRes.json();

                await db.collection("users").doc(userId).update({
                    saved_emails: firebase.firestore.FieldValue.arrayUnion({
                        address: newEmail,
                        password: newPassword,
                        token: tokData.token,
                        id: tokData.id,
                        createdAt: new Date().toISOString()
                    })
                });

                if (creatorModal) creatorModal.classList.add("hidden");
                if (dashCustomName) dashCustomName.value = "";
            } catch (e) {
                alert(e.message === "NAME_TAKEN" ? "الاسم محجوز!" : "فشل الإنشاء");
            } finally {
                dashCreateBtn.disabled = false;
                dashCreateBtn.innerHTML = "<i class='fa-solid fa-wand-magic-sparkles'></i> بنــاء وحفظ البريد الآن";
            }
        });
    }

    // --- Inbox Logic ---
    function openInboxFlow(address, token, id) {
        activeToken = token;
        activeAccountId = id;
        if (activeInboxTitle) activeInboxTitle.textContent = address;
        if (fullInbox) fullInbox.classList.remove("hidden");
        if (msgViewContent) msgViewContent.classList.add("hidden");
        if (msgViewerPlaceholder) msgViewerPlaceholder.classList.remove("hidden");
        if (refreshInterval) clearInterval(refreshInterval);
        loadInboxMessages(activeAccountId, activeToken);
        refreshInterval = setInterval(() => loadInboxMessages(activeAccountId, activeToken), 10000);
    }

    async function loadInboxMessages(id, token) {
        if (!id || !token || !inboxMessagesList) return;
        inboxMessagesList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i><p>جاري المزامنة السحابية...</p></div>';
        try {
            const res = await fetch(`${API_BASE}/messages`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            const remoteMsgs = data['hydra:member'] || [];
            const cacheKey = `dash_cache_msgs_${id}`;
            let localCache = JSON.parse(localStorage.getItem(cacheKey) || "[]");
            remoteMsgs.forEach(rm => { if (!localCache.find(lm => lm.id === rm.id)) localCache.unshift(rm); });
            if (localCache.length > 50) localCache = localCache.slice(0, 50);
            localStorage.setItem(cacheKey, JSON.stringify(localCache));
            renderMessages(localCache);
        } catch (e) {
            console.error(e);
            const cacheKey = `dash_cache_msgs_${id}`;
            const localCache = JSON.parse(localStorage.getItem(cacheKey) || "[]");
            renderMessages(localCache);
        }
    }

    if (closeInboxBtn) {
        closeInboxBtn.addEventListener("click", () => {
            if (fullInbox) fullInbox.classList.add("hidden");
            if (refreshInterval) clearInterval(refreshInterval);
        });
    }

    function renderMessages(msgs) {
        if (!inboxMessagesList) return;
        if (msgs.length === 0) {
            inboxMessagesList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-tray"></i><p>لا توجد رسائل بعد</p></div>`;
            return;
        }
        inboxMessagesList.innerHTML = "";
        msgs.forEach(m => {
            const el = document.createElement("div");
            el.className = "msg-item";
            const time = new Date(m.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            el.innerHTML = `
                <div class="msg-item-header">
                    <span class="msg-item-sender">${escapeHTML(m.from.name || m.from.address)}</span>
                    <span class="msg-item-time">${time}</span>
                </div>
                <div class="msg-item-subject">${escapeHTML(m.subject) || "(بدون موضوع)"}</div>
            `;
            el.onclick = () => loadMsgDetail(m.id);
            inboxMessagesList.appendChild(el);
        });
    }

    async function loadMsgDetail(id) {
        if (msgViewerPlaceholder) msgViewerPlaceholder.classList.add("hidden");
        if (msgViewContent) msgViewContent.classList.remove("hidden");
        if (msgViewFrame) {
            const docFrame = msgViewFrame.contentDocument;
            docFrame.open();
            docFrame.write('<body style="color:#999;font-family:sans-serif;display:flex;justify-content:center;padding-top:100px;background:#020617;">جاري تحميل...</body>');
            docFrame.close();
        }
        try {
            const res = await fetch(`${API_BASE}/messages/${id}`, { headers: { 'Authorization': `Bearer ${activeToken}` } });
            const data = await res.json();
            if (msgViewSubject) msgViewSubject.textContent = data.subject || "(بدون موضوع)";
            if (msgViewSender) msgViewSender.textContent = data.from.name || data.from.address;
            if (msgViewDate) msgViewDate.textContent = new Date(data.createdAt).toLocaleString('ar-EG');
            if (msgViewFrame) {
                const docFrame = msgViewFrame.contentDocument;
                docFrame.open();
                docFrame.write(`<head><style>body{font-family:sans-serif;padding:20px;color:#333;background:#fff;} img{max-width:100%;}</style></head><body>${data.html?.[0] || data.text?.[0]}</body>`);
                docFrame.close();
            }
        } catch (e) { console.error(e); }
    }

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Side Menu
    if (menuHome) {
        menuHome.onclick = (e) => {
            e.preventDefault();
            menuHome.classList.add("active");
            if (menuSaved) menuSaved.classList.remove("active");
            if (homeView) homeView.classList.add("active");
            if (savedView) savedView.classList.remove("active");
        };
    }
    if (menuSaved) {
        menuSaved.onclick = (e) => {
            e.preventDefault();
            menuSaved.classList.add("active");
            if (menuHome) menuHome.classList.remove("active");
            if (savedView) savedView.classList.add("active");
            if (homeView) homeView.classList.remove("active");
            renderEmailsGrid();
        };
    }
});
