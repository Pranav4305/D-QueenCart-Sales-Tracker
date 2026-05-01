// API Configuration
const API_BASE = '/api';

// State Management
let sales = [];
let transactions = [];

// DOM Elements
const salesBody = document.getElementById('sales-body');
const totalRevenueEl = document.getElementById('total-revenue');
const totalSalesEl = document.getElementById('total-sales');
const topCategoryEl = document.getElementById('top-category');
const searchInput = document.getElementById('search-input');
const filterDateInput = document.getElementById('filter-date');
const addSaleBtn = document.getElementById('add-sale-btn');
const modalOverlay = document.getElementById('modal-overlay');
const closeModal = document.getElementById('close-modal');
const saleForm = document.getElementById('sale-form');
const imgDropzone = document.getElementById('img-dropzone');
const imageInput = document.getElementById('image-input');
const previewImg = document.getElementById('preview-img');
const previewText = document.getElementById('preview-text');
const currentDateEl = document.getElementById('current-date');

// Current Image Base64
let currentImageBase64 = null;

// Initialize
async function init() {
    setCurrentDate();
    await fetchSales();
}

// Fetch Sales from MySQL
async function fetchSales() {
    const statusEl = document.getElementById('server-status');
    try {
        const response = await fetch(`${API_BASE}/sales`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        sales = data.map(item => ({
            id: item.id,
            t_id: item.transaction_id,
            category: item.category,
            price: item.price,
            quantity: item.quantity,
            image: item.image_data,
            date: item.sale_date
        }));

        // Group by transaction_id
        const groups = {};
        sales.forEach(s => {
            if (!groups[s.t_id]) groups[s.t_id] = [];
            groups[s.t_id].push(s);
        });

        // Convert to transaction list and sort CHRONOLOGICALLY first to assign numbers
        const sortedTids = Object.keys(groups).sort((a, b) => parseInt(a) - parseInt(b));
        
        transactions = sortedTids.map((tid, index) => {
            const items = groups[tid];
            return {
                id: tid,
                display_id: index + 1, // First sale = #1, Second = #2
                items: items,
                total_amount: items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
                items_count: items.reduce((sum, i) => sum + i.quantity, 0),
                date: items[0].date
            };
        });

        // Now sort for DISPLAY (Newest First)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (statusEl) { statusEl.textContent = '● Connected'; statusEl.style.color = '#10b981'; }
        renderSales();
        updateStats();
    } catch (err) {
        console.error('fetchSales error:', err);
        if (statusEl) { statusEl.textContent = '● Server Offline'; statusEl.style.color = '#ef4444'; }
        salesBody.innerHTML = `
            <tr><td colspan="6" style="text-align:center; padding:3rem;">
                <div style="color:#ef4444; font-weight:600; margin-bottom:0.75rem;">⚠ Cannot reach backend server</div>
                <div style="color:#94a3b8; font-size:0.8rem; margin-bottom:1.5rem;">${err.message}</div>
                <button onclick="fetchSales()" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:white;border:none;padding:0.6rem 1.5rem;border-radius:0.75rem;cursor:pointer;font-weight:600;">⟳ Retry Connection</button>
            </td></tr>`;
    }
}

// Date Setup
function setCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = new Date().toLocaleDateString(undefined, options);
}

// Render Sales Table (Transaction View)
function renderSales(filter = '') {
    salesBody.innerHTML = '';
    
    const filterDate = document.getElementById('filter-date')?.value;
    
    let filteredTransactions = transactions.filter(t => 
        t.items.some(item => item.category.toLowerCase().includes(filter.toLowerCase())) ||
        `Sale #${t.display_id}`.toLowerCase().includes(filter.toLowerCase())
    );

    if (filterDate) {
        filteredTransactions = filteredTransactions.filter(t => t.date && t.date.startsWith(filterDate));
    }

    filteredTransactions.forEach((t) => {
        const tr = document.createElement('tr');
        tr.className = 'sale-row';
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            if (!e.target.closest('button')) openSaleDetails(t.id);
        };
        
        tr.innerHTML = `
            <td style="font-weight: 700;">Sale #${t.display_id}</td>
            <td style="font-weight: 700; color: var(--accent-secondary);">₹${t.total_amount.toLocaleString()}</td>
            <td><span class="category-tag">${t.items_count} Items</span></td>
            <td style="color: var(--text-secondary); font-size: 0.875rem;">${new Date(t.date).toLocaleDateString()}</td>
            <td style="text-align: center;">
                <button onclick="deleteTransaction('${t.id}')" class="action-btn action-btn-delete" title="Delete Sale">
                    <i data-lucide="trash-2" style="width: 16px;"></i> Delete
                </button>
            </td>
        `;
        salesBody.appendChild(tr);
    });
    
    lucide.createIcons();
}

// Sale Details Modal
const saleDetailsOverlay = document.getElementById('sale-details-overlay');
const closeDetailsModal = document.getElementById('close-details-modal');
const detailsItemsBody = document.getElementById('details-items-body');

function openSaleDetails(tid) {
    const t = transactions.find(trans => trans.id === tid);
    if (!t) return;

    document.getElementById('details-sale-id').textContent = `Sale #${t.display_id}`;
    document.getElementById('details-sale-date').textContent = new Date(t.date).toLocaleDateString(undefined, { dateStyle: 'full' });
    document.getElementById('details-total-amount').textContent = `₹${t.total_amount.toLocaleString()}`;

    detailsItemsBody.innerHTML = t.items.map(item => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 1rem;"><span class="category-tag">${item.category}</span></td>
            <td>₹${item.price.toLocaleString()}</td>
            <td>${item.quantity}</td>
            <td style="font-weight: 700; color: var(--accent-secondary);">₹${(item.price * item.quantity).toLocaleString()}</td>
            <td>
                <img src="${item.image || 'https://via.placeholder.com/40?text=No+Img'}" 
                     style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">
            </td>
        </tr>
    `).join('');

    saleDetailsOverlay.style.display = 'flex';
    lucide.createIcons();
}

closeDetailsModal.onclick = () => saleDetailsOverlay.style.display = 'none';

window.deleteTransaction = async (tid) => {
    if (confirm('Are you sure you want to delete this entire sale? All products in this sale will be removed.')) {
        try {
            const response = await fetch(`${API_BASE}/transactions/${tid}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                await fetchSales();
            } else {
                alert('Error deleting transaction');
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Failed to connect to backend server');
        }
    }
};

// Update Dashboard Stats
function updateStats() {
    const filterDate = document.getElementById('filter-date')?.value;
    let filteredSales = sales;
    if (filterDate) {
        filteredSales = sales.filter(s => s.date && s.date.startsWith(filterDate));
    }

    const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.price * sale.quantity), 0);
    const totalSalesCount = filteredSales.length;
    
    const categoryCounts = {};
    filteredSales.forEach(sale => {
        categoryCounts[sale.category] = (categoryCounts[sale.category] || 0) + 1;
    });
    
    let topCategory = 'N/A';
    let maxCount = 0;
    for (const cat in categoryCounts) {
        if (categoryCounts[cat] > maxCount) {
            maxCount = categoryCounts[cat];
            topCategory = cat;
        }
    }

    animateValue(totalRevenueEl, 0, totalRevenue, 1000, true);
    totalSalesEl.textContent = totalSalesCount;
    topCategoryEl.textContent = topCategory;
}

function animateValue(obj, start, end, duration, isCurrency) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        obj.innerHTML = isCurrency ? `₹${current.toLocaleString()}` : current;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Modal Logic
addSaleBtn.onclick = () => {
    const saleDateInput = document.getElementById('sale-date');
    saleDateInput.value = new Date().toISOString().split('T')[0];
    // Reset to one row
    lineItemsContainer.innerHTML = createLineItemRow(true);
    updateGrandTotal();
    modalOverlay.style.display = 'flex';
    lucide.createIcons();
};
closeModal.onclick = () => closeModalAction();
window.onclick = (e) => { if (e.target == modalOverlay) closeModalAction(); };

function closeModalAction() {
    modalOverlay.style.display = 'none';
    saleForm.reset();
    lineItemsContainer.innerHTML = createLineItemRow(true);
    updateGrandTotal();
    document.getElementById('sale-date').value = new Date().toISOString().split('T')[0];
    resetImagePreview();
}

// Multi-Item Management
const lineItemsContainer = document.getElementById('line-items-container');
const addItemBtn = document.getElementById('add-item-row');
const grandTotalDisplay = document.getElementById('grand-total-display');

function createLineItemRow(isFirst = false) {
    const categories = ['Necklaces', 'Earrings', 'Studs', 'Rings', 'Hair Accessories', 'Bracelets', 'Scrunchies', 'Centre Clip', 'Clutch', 'Aligator Clip', 'TikTok Pin', 'Hair Bands', 'Nails'];
    const options = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    
    return `
        <div class="line-item" style="display: grid; grid-template-columns: 2fr 1fr 0.6fr 0.4fr; gap: 0.75rem; align-items: flex-end; margin-bottom: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
                <label>Category</label>
                <select class="item-category" required>${options}</select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Price (₹)</label>
                <input type="number" class="item-price" step="0.01" required placeholder="0.00" oninput="updateGrandTotal()">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Qty</label>
                <input type="number" class="item-qty" value="1" min="1" required oninput="updateGrandTotal()">
            </div>
            <div style="height: 42px; display: flex; align-items: center; justify-content: center;">
                ${!isFirst ? `<button type="button" class="remove-row" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i data-lucide="x"></i></button>` : ''}
            </div>
        </div>
    `;
}

addItemBtn.onclick = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = createLineItemRow(false);
    const newRow = tempDiv.firstElementChild;
    lineItemsContainer.appendChild(newRow);
    
    newRow.querySelector('.remove-row')?.addEventListener('click', () => {
        newRow.remove();
        updateGrandTotal();
    });
    
    lucide.createIcons();
};

window.updateGrandTotal = () => {
    let total = 0;
    const prices = document.querySelectorAll('.item-price');
    const qtys = document.querySelectorAll('.item-qty');
    
    prices.forEach((p, i) => {
        const val = parseFloat(p.value) || 0;
        const q = parseInt(qtys[i].value) || 0;
        total += val * q;
    });
    
    grandTotalDisplay.textContent = `₹${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Image Handling
imgDropzone.onclick = () => imageInput.click();

imageInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentImageBase64 = event.target.result;
            previewImg.src = currentImageBase64;
            previewImg.style.display = 'block';
            previewText.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
};

function resetImagePreview() {
    currentImageBase64 = null;
    previewImg.src = '';
    previewImg.style.display = 'none';
    previewText.style.display = 'block';
}

// Form Submission (To MySQL)
saleForm.onsubmit = async (e) => {
    e.preventDefault();
    
    const date = document.getElementById('sale-date').value;
    const rows = document.querySelectorAll('.line-item');
    const items = [];
    
    rows.forEach(row => {
        items.push({
            category: row.querySelector('.item-category').value,
            price: parseFloat(row.querySelector('.item-price').value),
            quantity: parseInt(row.querySelector('.item-qty').value),
            date: date,
            image: currentImageBase64
        });
    });

    try {
        const response = await fetch(`${API_BASE}/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(items)
        });
        
        if (response.ok) {
            await fetchSales();
            closeModalAction();
        } else {
            alert('Error saving sales to database');
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Failed to connect to backend server');
    }
};

// Delete Sale (From MySQL)
window.deleteSale = async (id) => {
    if (confirm('Are you sure you want to delete this sale?')) {
        try {
            const response = await fetch(`${API_BASE}/sales/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await fetchSales();
            } else {
                alert('Error deleting sale');
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Failed to connect to backend server');
        }
    }
};

// Search Logic
searchInput.oninput = (e) => renderSales(e.target.value);

// Filter Date Logic
if (filterDateInput) {
    filterDateInput.onchange = () => {
        updateStats();
        renderSales(searchInput.value);
    };
}

// =====================
// Edit Image Modal Logic
// =====================
const editImgOverlay = document.getElementById('edit-img-overlay');
const closeEditImgModal = document.getElementById('close-edit-img-modal');
const editImgDropzone = document.getElementById('edit-img-dropzone');
const editImageInput = document.getElementById('edit-image-input');
const editPreviewImg = document.getElementById('edit-preview-img');
const editPreviewText = document.getElementById('edit-preview-text');
const saveImgBtn = document.getElementById('save-img-btn');

let editTargetSaleId = null;
let editImageBase64 = null;

window.openEditImageModal = (id) => {
    editTargetSaleId = id;
    editImageBase64 = null;
    editPreviewImg.src = '';
    editPreviewImg.style.display = 'none';
    editPreviewText.style.display = 'block';
    editImageInput.value = '';
    editImgOverlay.style.display = 'flex';
    lucide.createIcons();
};

closeEditImgModal.onclick = () => editImgOverlay.style.display = 'none';
window.onclick = (e) => {
    if (e.target == modalOverlay) closeModalAction();
    if (e.target == editImgOverlay) editImgOverlay.style.display = 'none';
};

editImgDropzone.onclick = () => editImageInput.click();

editImageInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            editImageBase64 = event.target.result;
            editPreviewImg.src = editImageBase64;
            editPreviewImg.style.display = 'block';
            editPreviewText.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
};

saveImgBtn.onclick = async () => {
    if (!editImageBase64) {
        alert('Please select an image first.');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/sales/${editTargetSaleId}/image`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: editImageBase64 })
        });
        if (response.ok) {
            editImgOverlay.style.display = 'none';
            await fetchSales();
        } else {
            alert('Failed to update image.');
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Failed to connect to backend server.');
    }
};

// Run App
init();

// ========================
// TAB SWITCHER
// ========================
window.switchTab = (tab) => {
    document.getElementById('pane-sales').style.display = tab === 'sales' ? 'block' : 'none';
    document.getElementById('pane-analytics').style.display = tab === 'analytics' ? 'block' : 'none';
    document.getElementById('tab-sales').classList.toggle('active', tab === 'sales');
    document.getElementById('tab-analytics').classList.toggle('active', tab === 'analytics');
    if (tab === 'analytics') setTimeout(() => { renderCharts(); analyzePatterns(); }, 50);
    lucide.createIcons();
};

// ========================
// CHARTS (Chart.js)
// ========================
let chartRevenue = null, chartCategory = null, chartDaily = null;
const CHART_COLORS = ['#8b5cf6','#06b6d4','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#14b8a6','#f97316','#a855f7','#84cc16','#d946ef'];
const GRID_COLOR = 'rgba(255,255,255,0.05)';
const TICK_COLOR = '#94a3b8';

function renderCharts() {
    // Revenue Over Time — last 30 days
    const today = new Date();
    const revLabels = [], revData = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        revLabels.push(d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
        revData.push(sales.filter(s => s.date.startsWith(ds)).reduce((sum, s) => sum + s.price * s.quantity, 0));
    }
    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(document.getElementById('chart-revenue'), {
        type: 'line',
        data: { labels: revLabels, datasets: [{ label: 'Revenue (₹)', data: revData, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.12)', fill: true, tension: 0.4, pointBackgroundColor: '#8b5cf6', pointRadius: 3, pointHoverRadius: 6 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: TICK_COLOR, maxTicksLimit: 8 }, grid: { color: GRID_COLOR } }, y: { ticks: { color: TICK_COLOR, callback: v => '₹' + v.toLocaleString() }, grid: { color: GRID_COLOR }, beginAtZero: true } } }
    });

    // Sales by Category — Doughnut
    const catMap = {};
    sales.forEach(s => catMap[s.category] = (catMap[s.category] || 0) + s.price * s.quantity);
    const catLabels = Object.keys(catMap);
    if (chartCategory) chartCategory.destroy();
    chartCategory = new Chart(document.getElementById('chart-category'), {
        type: 'doughnut',
        data: { labels: catLabels, datasets: [{ data: catLabels.map(k => catMap[k]), backgroundColor: CHART_COLORS.slice(0, catLabels.length), borderWidth: 2, borderColor: '#0f172a' }] },
        options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'right', labels: { color: TICK_COLOR, padding: 12, font: { size: 11 } } } } }
    });

    // Daily Volume — Bar by day of week
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayCounts = [0,0,0,0,0,0,0];
    sales.forEach(s => dayCounts[new Date(s.date).getDay()]++);
    const todayIdx = new Date().getDay();
    if (chartDaily) chartDaily.destroy();
    chartDaily = new Chart(document.getElementById('chart-daily'), {
        type: 'bar',
        data: { labels: dayLabels, datasets: [{ label: 'Sales', data: dayCounts, backgroundColor: dayLabels.map((_, i) => i === todayIdx ? '#06b6d4' : 'rgba(139,92,246,0.5)'), borderRadius: 8, borderSkipped: false }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: TICK_COLOR }, grid: { color: GRID_COLOR } }, y: { ticks: { color: TICK_COLOR, stepSize: 1 }, grid: { color: GRID_COLOR }, beginAtZero: true } } }
    });
}

// ========================
// PATTERN ANALYZER
// ========================
function analyzePatterns() {
    const grid = document.getElementById('insight-grid');
    if (!sales.length) { grid.innerHTML = '<div class="insight-placeholder">Add some sales to see patterns emerge...</div>'; return; }

    const totalRev = sales.reduce((sum, s) => sum + s.price * s.quantity, 0);

    const catRevenue = {};
    sales.forEach(s => catRevenue[s.category] = (catRevenue[s.category] || 0) + s.price * s.quantity);
    const topCat = Object.entries(catRevenue).sort((a, b) => b[1] - a[1])[0];

    const now = new Date();
    const w1 = new Date(now); w1.setDate(now.getDate() - 7);
    const w2 = new Date(now); w2.setDate(now.getDate() - 14);
    const thisWeekRev = sales.filter(s => new Date(s.date) >= w1).reduce((sum, s) => sum + s.price * s.quantity, 0);
    const lastWeekRev = sales.filter(s => new Date(s.date) >= w2 && new Date(s.date) < w1).reduce((sum, s) => sum + s.price * s.quantity, 0);
    const trend = lastWeekRev ? (((thisWeekRev - lastWeekRev) / lastWeekRev) * 100).toFixed(1) : null;
    const trendUp = parseFloat(trend) >= 0;

    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayCounts = [0,0,0,0,0,0,0];
    sales.forEach(s => dayCounts[new Date(s.date).getDay()]++);
    const peakIdx = dayCounts.indexOf(Math.max(...dayCounts));

    const catCount = {};
    sales.forEach(s => catCount[s.category] = (catCount[s.category] || 0) + 1);
    const mostActive = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];

    const avgOrder = (totalRev / sales.length).toFixed(2);
    const topCatPct = ((topCat[1] / totalRev) * 100).toFixed(0);
    const rec = parseInt(topCatPct) > 50
        ? `${topCat[0]} drives ${topCatPct}% of your revenue. Consider diversifying to reduce reliance on one category.`
        : `${topCat[0]} leads at ${topCatPct}% of revenue. Growing other categories could further boost total income.`;

    const insights = [
        { icon: '🏆', label: 'Top Revenue Category', value: topCat[0], sub: `₹${topCat[1].toLocaleString()} total earned`, color: '#8b5cf6' },
        { icon: trendUp ? '📈' : '📉', label: 'Weekly Revenue Trend', value: trend !== null ? `${trendUp ? '+' : ''}${trend}%` : 'First week!', sub: `₹${thisWeekRev.toLocaleString()} this week vs ₹${lastWeekRev.toLocaleString()} last week`, color: (trendUp || trend === null) ? '#10b981' : '#ef4444' },
        { icon: '⏰', label: 'Peak Sales Day', value: dayNames[peakIdx], sub: `${dayCounts[peakIdx]} sale(s) on ${dayNames[peakIdx]}s historically`, color: '#06b6d4' },
        { icon: '💰', label: 'Avg. Order Value', value: `₹${parseFloat(avgOrder).toLocaleString()}`, sub: `Across ${sales.length} total sale(s)`, color: '#f59e0b' },
        { icon: '🔥', label: 'Most Active Category', value: mostActive[0], sub: `${mostActive[1]} sale(s) recorded`, color: '#f97316' },
        { icon: '💡', label: 'Smart Recommendation', value: 'Insight', sub: rec, color: '#3b82f6', wide: true }
    ];

    grid.innerHTML = insights.map(ins => `
        <div class="insight-card ${ins.wide ? 'insight-wide' : ''}" style="border-left-color:${ins.color};">
            <div class="insight-icon">${ins.icon}</div>
            <div class="insight-body">
                <div class="insight-label">${ins.label}</div>
                <div class="insight-value" style="color:${ins.color};">${ins.value}</div>
                <div class="insight-sub">${ins.sub}</div>
            </div>
        </div>
    `).join('');
}

// ========================
// EDIT SALE LOGIC
// ========================
const editSaleOverlay = document.getElementById('edit-sale-overlay');
const closeEditModal = document.getElementById('close-edit-modal');
const editSaleForm = document.getElementById('edit-sale-form');

window.openEditModal = (id) => {
    const sale = sales.find(s => s.id === id);
    if (!sale) return;

    document.getElementById('edit-sale-id').value = sale.id;
    document.getElementById('edit-category').value = sale.category;
    document.getElementById('edit-price').value = sale.price;
    document.getElementById('edit-quantity').value = sale.quantity;
    
    // Format date for input[type="date"]
    if (sale.date) {
        document.getElementById('edit-sale-date').value = sale.date.split('T')[0];
    }

    editSaleOverlay.style.display = 'flex';
    lucide.createIcons();
};

closeEditModal.onclick = () => editSaleOverlay.style.display = 'none';

editSaleForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-sale-id').value;
    const updatedData = {
        category: document.getElementById('edit-category').value,
        price: parseFloat(document.getElementById('edit-price').value),
        quantity: parseInt(document.getElementById('edit-quantity').value),
        date: document.getElementById('edit-sale-date').value
    };

    try {
        const response = await fetch(`${API_BASE}/sales/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        if (response.ok) {
            editSaleOverlay.style.display = 'none';
            await fetchSales();
        } else {
            alert('Error updating sale');
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Failed to connect to backend server');
    }
};

window.onclick = (e) => {
    if (e.target == modalOverlay) closeModalAction();
    if (e.target == editImgOverlay) editImgOverlay.style.display = 'none';
    if (e.target == editSaleOverlay) editSaleOverlay.style.display = 'none';
    if (e.target == saleDetailsOverlay) saleDetailsOverlay.style.display = 'none';
};
