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
                // Ensure initial view is handled if not already
                if (document.getElementById("homeView").classList.contains("hidden") && 
                    document.getElementById("savedView").classList.contains("hidden") && 
                    document.getElementById("archiveView").classList.contains("hidden")) {
                    switchView("homeView", "menuHome");
                }
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

    const inboxManualRefresh = document.getElementById("inboxManualRefresh");
    if (inboxManualRefresh) {
        inboxManualRefresh.addEventListener("click", () => {
            const icon = inboxManualRefresh.querySelector("i");
            if (icon) icon.classList.add("fa-spin");
            loadInboxMessages(activeAccountId, activeToken).finally(() => {
                setTimeout(() => { if (icon) icon.classList.remove("fa-spin"); }, 600);
            });
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

    // --- View Switcher ---
    function switchView(viewId, menuId) {
        console.log("Switching to view:", viewId);
        // Hide all views by removing active class
        document.querySelectorAll(".dashboard-view, .view-content").forEach(el => {
            el.classList.remove("active");
            el.classList.add("hidden"); // Backup
        });
        
        // Deactivate all links
        ["menuHome", "menuSaved", "menuArchive"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove("active");
        });
        
        // Show target view by adding active class
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add("active");
            targetView.classList.remove("hidden");
        }

        // Activate target link
        const targetMenu = document.getElementById(menuId);
        if (targetMenu) targetMenu.classList.add("active");

        // View specific title
        const config = {
            "homeView": { name: "أهلاً بك في إيميل كوبرا", desc: "هنا يمكنك إدارة جميع حساباتك الوهمية بنقرة واحدة." },
            "savedView": { name: "إيميلاتي المحفوظة", desc: "قائمة العناوين التي قمت بحجزها بشكل دائم على السحاب." },
            "archiveView": { name: "الأرشيف السحابي", desc: "رسائلك المحفوظة للأبد، حتى بعد انتهاء صلاحية البريد الأصلي." }
        };
        if (viewName) viewName.textContent = config[viewId].name;
        if (viewDesc) viewDesc.textContent = config[viewId].desc;
        
        // Hide/Show header actions
        if (headerActions) {
            headerActions.style.display = (viewId === "savedView") ? "block" : "none";
        }
    }

    if (menuHome) {
        menuHome.onclick = (e) => { e.preventDefault(); switchView("homeView", "menuHome"); };
    }
    if (menuSaved) {
        menuSaved.onclick = (e) => { e.preventDefault(); switchView("savedView", "menuSaved"); renderEmailsGrid(); };
    }
    if (menuArchive) {
        menuArchive.onclick = (e) => { 
            e.preventDefault(); 
            switchView("archiveView", "menuArchive"); 
            loadArchivedMessages(); 
        };
    }

    // --- ARCHIVE LOGIC ---
    async function loadArchivedMessages() {
        if (!userId || !archivedList) return;
        archivedList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-sync fa-spin"></i><p>جاري جلب الأرشيف من السحاب...</p></div>';
        try {
            const snapshot = await db.collection("archived_messages")
                                      .where("userId", "==", userId)
                                      .get();
            
            if (snapshot.empty) {
                archivedList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>أرشيفك السحابي فارغ حالياً.</p></div>';
                return;
            }

            archivedList.innerHTML = "";
            snapshot.forEach(doc => {
                const data = doc.data();
                const el = document.createElement("div");
                el.className = "msg-item";
                const date = new Date(data.createdAt).toLocaleDateString('ar-EG');
                el.innerHTML = `
                    <div class="msg-item-header">
                        <span class="msg-item-sender">${escapeHTML(data.from.address)}</span>
                        <span class="msg-item-time">${date}</span>
                    </div>
                    <div class="msg-item-subject">${escapeHTML(data.subject) || "(بدون موضوع)"}</div>
                    <div style="font-size:10px; opacity:0.6; margin-top:5px; color:var(--primary-color);">من: ${data.accountEmail}</div>
                `;
                el.onclick = () => renderArchivedDetail(data);
                archivedList.appendChild(el);
            });
        } catch(e) { 
            console.error("Archive Load Error:", e);
            if (e.code === "permission-denied") {
                archivedList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-shield-halved"></i><p>تحتاج لتفعيل صلاحيات الأرشيف في Firebase Console لتتمكن من رؤية رسائلك.</p></div>';
            } else if (e.message.includes("index")) {
                archivedList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-hammer"></i><p>جاري بناء فهارس الأرشيف في السحاب.. يرجى الضغط على الرابط في Console المتصفح وتأكيد إنشاء الـ Index.</p></div>';
            } else {
                archivedList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>فشل جلب الأرشيف.</p></div>';
            }
        }
    }

    function renderArchivedDetail(data) {
        if (!archiveDetail) return;
        archiveDetail.innerHTML = `
            <div class="msg-detail-header-v2">
                <div class="msg-detail-sender-info">
                    <div class="msg-avatar-circle">${(data.from.name || data.from.address || "?")[0].toUpperCase()}</div>
                    <div class="msg-sender-meta">
                        <h3>${escapeHTML(data.from.address)}</h3>
                        <span>تاريخ الرسالة: ${new Date(data.createdAt).toLocaleString('ar-EG')}</span>
                    </div>
                </div>
            </div>
            <div class="msg-detail-body">
                <h2 style="margin-bottom:20px; font-weight:800; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:15px;">${escapeHTML(data.subject)}</h2>
                <div class="msg-detail-body-container" style="background:#fff; border-radius:12px; height: 500px; overflow:hidden;">
                    <iframe id="archivedIframe" style="width:100%; height:100%; border:none;"></iframe>
                </div>
            </div>
        `;
        const iframe = document.getElementById("archivedIframe");
        if (iframe) {
            const doc = iframe.contentDocument;
            doc.open();
            doc.write(`<head><style>body{font-family:sans-serif;padding:15px;color:#111;} img{max-width:100%; height:auto;}</style></head><body>${data.html || data.text}</body>`);
            doc.close();
        }
    }
});
