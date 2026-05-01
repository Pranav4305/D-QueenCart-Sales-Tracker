const API_BASE = '/api';
const CATEGORIES = ['Necklaces','Earrings','Studs','Rings','Hair Accessories','Bracelets','Scrunchies','Centre Clip','Clutch','Aligator Clip','TikTok Pin','Hair Bands','Nails'];

let sales = [], transactions = [], isLoading = false;
let selectedDate = toLocalDate(new Date()); // "YYYY-MM-DD" — primary state

// ── DOM REFS ─────────────────────────────────────────────
const salesBody        = document.getElementById('sales-body');
const totalRevenueEl   = document.getElementById('total-revenue');
const totalSalesEl     = document.getElementById('total-sales');
const topCategoryEl    = document.getElementById('top-category');
const revenueLabelEl   = document.getElementById('revenue-label');
const salesLabelEl     = document.getElementById('sales-label');
const categoryLabelEl  = document.getElementById('category-label');
const searchInput      = document.getElementById('search-input');
const addSaleBtn       = document.getElementById('add-sale-btn');
const modalOverlay     = document.getElementById('modal-overlay');
const closeModal       = document.getElementById('close-modal');
const saleForm         = document.getElementById('sale-form');
const imgDropzone      = document.getElementById('img-dropzone');
const imageInput       = document.getElementById('image-input');
const previewImg       = document.getElementById('preview-img');
const previewText      = document.getElementById('preview-text');
const datePickerInput  = document.getElementById('date-picker-input');
const dateNavLabel     = document.getElementById('date-nav-label');
const lineItemsContainer = document.getElementById('line-items-container');
const addItemBtn       = document.getElementById('add-item-row');
const grandTotalDisplay = document.getElementById('grand-total-display');
let currentImageBase64 = null;

// ── HELPERS ─────────────────────────────────────────────
function toLocalDate(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function formatDate(str) {
    if (!str) return 'N/A';
    // Parse as local date to avoid timezone offset issues
    const [y,m,d] = str.split('-').map(Number);
    return new Date(y, m-1, d).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
}
function buildOptions(sel='') {
    return CATEGORIES.map(c=>`<option value="${c}"${c===sel?' selected':''}>${c}</option>`).join('');
}

// ── TOAST ──────────────────────────────────────────────
function showToast(msg, type='success') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${type==='success'?'✅':type==='error'?'❌':'ℹ️'}</span><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => t.classList.add('toast-show'), 10);
    setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 400); }, 3000);
}

// ── LOADING ─────────────────────────────────────────────
function setLoading(state) {
    isLoading = state;
    document.getElementById('loading-skeleton').style.display = state ? 'block' : 'none';
    document.getElementById('table-wrapper').style.display   = state ? 'none'  : 'block';
}

// ── DATE NAVIGATOR ───────────────────────────────────────
function setSelectedDate(dateStr) {
    selectedDate = dateStr;
    datePickerInput.value = dateStr;
    const today = toLocalDate(new Date());
    const yesterday = toLocalDate(new Date(Date.now() - 86400000));
    const isToday = dateStr === today;
    const isYesterday = dateStr === yesterday;

    const badge = isToday ? ' <span class="date-today-badge">Today</span>'
                : isYesterday ? ' <span class="date-today-badge" style="background:linear-gradient(135deg,#06b6d4,#0891b2)">Yesterday</span>'
                : '';
    dateNavLabel.innerHTML = formatDate(dateStr) + badge;

    // Shortcut button active state
    document.getElementById('shortcut-today').classList.toggle('active', isToday);
    document.getElementById('shortcut-yesterday').classList.toggle('active', isYesterday);

    // Update "next" button opacity — can't go beyond today
    document.getElementById('next-day-btn').style.opacity = dateStr >= today ? '0.35' : '1';

    renderSales();
    updateStats();
    if (document.getElementById('pane-analytics').style.display !== 'none') {
        setTimeout(() => { renderCharts(); analyzePatterns(); }, 50);
    }
}

function shiftDate(days) {
    const [y,m,d] = selectedDate.split('-').map(Number);
    const nd = new Date(y, m-1, d);
    nd.setDate(nd.getDate() + days);
    const newDate = toLocalDate(nd);
    if (newDate > toLocalDate(new Date())) return; // block future dates
    setSelectedDate(newDate);
}

document.getElementById('prev-day-btn').onclick = () => shiftDate(-1);
document.getElementById('next-day-btn').onclick = () => shiftDate(+1);
document.getElementById('shortcut-today').onclick = () => setSelectedDate(toLocalDate(new Date()));
document.getElementById('shortcut-yesterday').onclick = () => setSelectedDate(toLocalDate(new Date(Date.now()-86400000)));
datePickerInput.onchange = e => { if (e.target.value) setSelectedDate(e.target.value); };
// Max date = today
datePickerInput.max = toLocalDate(new Date());

// ── INIT ────────────────────────────────────────────────
async function init() {
    const saved = localStorage.getItem('activeTab') || 'sales';
    switchTab(saved);
    await fetchSales();
    // Set date after data loaded (triggers render)
    const savedDate = localStorage.getItem('selectedDate') || toLocalDate(new Date());
    setSelectedDate(savedDate);
}

// ── FETCH ───────────────────────────────────────────────
async function fetchSales() {
    const statusEl = document.getElementById('server-status');
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/sales`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        sales = data.map(i => ({
            id: i.id, t_id: i.transaction_id, category: i.category,
            price: i.price, quantity: i.quantity, image: i.image_data, date: i.sale_date
        }));

        const groups = {};
        sales.forEach(s => { if(!groups[s.t_id]) groups[s.t_id]=[]; groups[s.t_id].push(s); });
        const sorted = Object.keys(groups).sort((a,b) => a.localeCompare(b));
        transactions = sorted.map((tid, i) => {
            const items = groups[tid];
            return { id:tid, display_id:i+1, items, date:items[0].date,
                total_amount: items.reduce((s,x)=>s+(x.price*x.quantity),0),
                items_count:  items.reduce((s,x)=>s+x.quantity,0) };
        });
        transactions.sort((a,b)=>new Date(b.date)-new Date(a.date));

        if (statusEl) { statusEl.textContent='● Connected'; statusEl.style.color='#10b981'; }
    } catch(err) {
        if (statusEl) { statusEl.textContent='● Server Offline'; statusEl.style.color='#ef4444'; }
        salesBody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title" style="color:#ef4444">Cannot reach server</div><div class="empty-sub">${err.message}</div><button onclick="fetchSales()" class="btn btn-primary" style="margin-top:1rem">⟳ Retry</button></div></td></tr>`;
    } finally { setLoading(false); }
}

// ── RENDER TABLE ─────────────────────────────────────────
function renderSales(filter='') {
    if (isLoading) return;
    const fd = selectedDate;
    let list = transactions.filter(t => toLocalDate(t.date) === fd);

    if (filter) {
        list = list.filter(t =>
            t.items.some(i => i.category.toLowerCase().includes(filter.toLowerCase())) ||
            `Sale #${t.display_id}`.toLowerCase().includes(filter.toLowerCase())
        );
    }

    if (!list.length) {
        salesBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
            <div class="empty-icon">🛍️</div>
            <div class="empty-title">No sales on ${formatDate(fd)}</div>
            <div class="empty-sub">Click "Add Sale" to record the first sale for this date.</div>
        </div></td></tr>`;
        return;
    }

    salesBody.innerHTML = '';
    list.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = 'sale-row'; tr.style.cursor = 'pointer';
        tr.onclick = e => { if (!e.target.closest('button')) openSaleDetails(t.id); };
        // Show time if available
        const timeStr = t.date && t.date.includes('T')
            ? new Date(t.date).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})
            : '—';
        tr.innerHTML = `
            <td style="font-weight:700">Sale #${t.display_id}</td>
            <td style="font-weight:700;color:var(--accent-secondary)">₹${t.total_amount.toLocaleString('en-IN')}</td>
            <td><span class="category-tag">${t.items_count} Items</span></td>
            <td style="color:var(--text-secondary);font-size:.875rem">${timeStr}</td>
            <td style="text-align:center">
                <button onclick="deleteTransaction('${t.id}')" class="action-btn action-btn-delete">
                    <i data-lucide="trash-2" style="width:16px"></i> Delete
                </button>
            </td>`;
        salesBody.appendChild(tr);
    });
    lucide.createIcons();
}

// ── STATS ─────────────────────────────────────────────────
function updateStats() {
    const fd = selectedDate;
    const filtered = sales.filter(s => toLocalDate(s.date) === fd);
    const rev = filtered.reduce((s,x)=>s+(x.price*x.quantity),0);
    const cats = {};
    filtered.forEach(s => cats[s.category] = (cats[s.category]||0)+1);
    const top = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'N/A';

    revenueLabelEl.textContent   = 'Revenue';
    salesLabelEl.textContent     = 'Transactions';
    categoryLabelEl.textContent  = 'Top Category';

    animateVal(totalRevenueEl, 0, rev, 800, true);
    totalSalesEl.textContent = transactions.filter(t => toLocalDate(t.date) === fd).length;
    topCategoryEl.textContent = top;

    localStorage.setItem('selectedDate', fd);
}

function animateVal(el, start, end, dur, cur) {
    let ts=null;
    const step=t=>{ if(!ts)ts=t; const p=Math.min((t-ts)/dur,1); el.innerHTML=(cur?'₹':'')+Math.floor(p*(end-start)+start).toLocaleString('en-IN'); if(p<1)requestAnimationFrame(step); };
    requestAnimationFrame(step);
}

// ── SALE DETAILS MODAL ────────────────────────────────────
const saleDetailsOverlay = document.getElementById('sale-details-overlay');
document.getElementById('close-details-modal').onclick = () => saleDetailsOverlay.style.display='none';

function openSaleDetails(tid) {
    const t = transactions.find(x=>x.id===tid); if(!t)return;
    document.getElementById('details-sale-id').textContent    = `Sale #${t.display_id}`;
    document.getElementById('details-sale-date').textContent  = formatDate(selectedDate);
    document.getElementById('details-total-amount').textContent = `₹${t.total_amount.toLocaleString('en-IN')}`;
    document.getElementById('details-items-body').innerHTML = t.items.map(item=>`
        <tr style="border-bottom:1px solid rgba(255,255,255,.05)">
            <td style="padding:1rem"><span class="category-tag">${item.category}</span></td>
            <td>₹${item.price.toLocaleString('en-IN')}</td>
            <td>${item.quantity}</td>
            <td style="font-weight:700;color:var(--accent-secondary)">₹${(item.price*item.quantity).toLocaleString('en-IN')}</td>
            <td>${item.image?`<img src="${item.image}" style="width:40px;height:40px;border-radius:8px;object-fit:cover">`:`<div class="no-img-placeholder">📦</div>`}</td>
        </tr>`).join('');
    saleDetailsOverlay.style.display='flex';
}

window.deleteTransaction = async tid => {
    if (!confirm('Delete this entire sale?')) return;
    try {
        const r = await fetch(`${API_BASE}/transactions/${tid}`,{method:'DELETE'});
        if (r.ok) { await fetchSales(); setSelectedDate(selectedDate); showToast('Sale deleted.'); }
        else showToast('Error deleting.','error');
    } catch { showToast('Connection failed.','error'); }
};

// ── ADD SALE MODAL ────────────────────────────────────────
function createLineItemRow(isFirst=false) {
    return `<div class="line-item" style="display:grid;grid-template-columns:2fr 1fr .6fr .4fr;gap:.75rem;align-items:flex-end;margin-bottom:1rem">
        <div class="form-group" style="margin-bottom:0"><label>Category</label><select class="item-category" required>${buildOptions()}</select></div>
        <div class="form-group" style="margin-bottom:0"><label>Price (₹)</label><input type="number" class="item-price" step=".01" required placeholder="0.00" oninput="updateGrandTotal()"></div>
        <div class="form-group" style="margin-bottom:0"><label>Qty</label><input type="number" class="item-qty" value="1" min="1" required oninput="updateGrandTotal()"></div>
        <div style="height:42px;display:flex;align-items:center;justify-content:center">${!isFirst?`<button type="button" class="remove-row" style="background:none;border:none;color:#ef4444;cursor:pointer"><i data-lucide="x"></i></button>`:''}</div>
    </div>`;
}

addSaleBtn.onclick = () => {
    // Show selected date in modal header
    document.getElementById('modal-date-display').textContent = `📅 ${formatDate(selectedDate)}`;
    lineItemsContainer.innerHTML = createLineItemRow(true);
    updateGrandTotal();
    modalOverlay.style.display='flex';
    lucide.createIcons();
};
closeModal.onclick = closeModalAction;

function closeModalAction() {
    modalOverlay.style.display='none'; saleForm.reset();
    lineItemsContainer.innerHTML = createLineItemRow(true); updateGrandTotal();
    currentImageBase64=null; previewImg.src=''; previewImg.style.display='none'; previewText.style.display='block';
}

addItemBtn.onclick = () => {
    const d=document.createElement('div'); d.innerHTML=createLineItemRow(false);
    const row=d.firstElementChild; lineItemsContainer.appendChild(row);
    row.querySelector('.remove-row')?.addEventListener('click',()=>{ row.remove(); updateGrandTotal(); });
    lucide.createIcons();
};

window.updateGrandTotal = () => {
    let t=0;
    document.querySelectorAll('.item-price').forEach((p,i)=>{ const q=document.querySelectorAll('.item-qty')[i]; t+=(parseFloat(p.value)||0)*(parseInt(q?.value)||0); });
    grandTotalDisplay.textContent=`₹${t.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
};

imgDropzone.onclick = () => imageInput.click();
imageInput.onchange = e => {
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{ currentImageBase64=ev.target.result; previewImg.src=currentImageBase64; previewImg.style.display='block'; previewText.style.display='none'; };
    r.readAsDataURL(f);
};

saleForm.onsubmit = async e => {
    e.preventDefault();
    const items=[];
    document.querySelectorAll('.line-item').forEach(row=>{
        const price=parseFloat(row.querySelector('.item-price').value);
        const qty=parseInt(row.querySelector('.item-qty').value);
        if(price>0&&qty>=1) items.push({category:row.querySelector('.item-category').value,price,quantity:qty,date:selectedDate,image:currentImageBase64});
    });
    if(!items.length){showToast('Enter valid price & quantity.','error');return;}
    const btn=saleForm.querySelector('[type="submit"]'); btn.disabled=true; btn.textContent='Saving...';
    try {
        const r=await fetch(`${API_BASE}/sales`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(items)});
        if(r.ok){ await fetchSales(); setSelectedDate(selectedDate); closeModalAction(); showToast(`${items.length} item(s) recorded! 🎉`); }
        else{ const err=await r.json(); showToast(err.error||'Error saving.','error'); }
    } catch{ showToast('Connection failed.','error'); }
    finally{ btn.disabled=false; btn.textContent='Record All Sales'; }
};

// ── SEARCH ───────────────────────────────────────────────
searchInput.oninput = e => renderSales(e.target.value);

// ── SINGLE window.onclick ─────────────────────────────────
window.onclick = e => {
    if(e.target===modalOverlay) closeModalAction();
    if(e.target===document.getElementById('edit-img-overlay')) document.getElementById('edit-img-overlay').style.display='none';
    if(e.target===saleDetailsOverlay) saleDetailsOverlay.style.display='none';
};

// ── TAB SWITCHER ──────────────────────────────────────────
window.switchTab = tab => {
    document.getElementById('pane-sales').style.display      = tab==='sales'     ? 'block':'none';
    document.getElementById('pane-analytics').style.display  = tab==='analytics' ? 'block':'none';
    document.getElementById('tab-sales').classList.toggle('active', tab==='sales');
    document.getElementById('tab-analytics').classList.toggle('active', tab==='analytics');
    localStorage.setItem('activeTab', tab);
    if(tab==='analytics') setTimeout(()=>{ renderCharts(); analyzePatterns(); },50);
    lucide.createIcons();
};

// ── CHARTS ────────────────────────────────────────────────
// Analytics always shows ALL-TIME data for context (charts are most useful across dates)
let chartRevenue=null, chartCategory=null, chartDaily=null;
const CC=['#8b5cf6','#06b6d4','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#14b8a6','#f97316','#a855f7','#84cc16','#d946ef'];
const GC='rgba(255,255,255,.05)', TC='#94a3b8';

function renderCharts() {
    const today=new Date(), rL=[], rD=[];
    for(let i=29;i>=0;i--){
        const d=new Date(today); d.setDate(d.getDate()-i);
        const ds=toLocalDate(d);
        rL.push(d.toLocaleDateString('en-IN',{month:'short',day:'numeric'}));
        rD.push(sales.filter(s=>toLocalDate(s.date)===ds).reduce((a,s)=>a+s.price*s.quantity,0));
    }
    if(chartRevenue) chartRevenue.destroy();
    chartRevenue=new Chart(document.getElementById('chart-revenue'),{type:'line',data:{labels:rL,datasets:[{label:'Revenue (₹)',data:rD,borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,.12)',fill:true,tension:.4,pointBackgroundColor:'#8b5cf6',pointRadius:3,pointHoverRadius:6}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:TC,maxTicksLimit:8},grid:{color:GC}},y:{ticks:{color:TC,callback:v=>'₹'+v.toLocaleString('en-IN')},grid:{color:GC},beginAtZero:true}}}});

    const cm={};
    sales.forEach(s=>cm[s.category]=(cm[s.category]||0)+s.price*s.quantity);
    const cl=Object.keys(cm);
    if(chartCategory) chartCategory.destroy();
    chartCategory=new Chart(document.getElementById('chart-category'),{type:'doughnut',data:{labels:cl,datasets:[{data:cl.map(k=>cm[k]),backgroundColor:CC.slice(0,cl.length),borderWidth:2,borderColor:'#0f172a'}]},options:{responsive:true,cutout:'65%',plugins:{legend:{position:'right',labels:{color:TC,padding:12,font:{size:11}}}}}});

    const dl=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],dc=[0,0,0,0,0,0,0];
    sales.forEach(s=>dc[new Date(s.date).getDay()]++);
    if(chartDaily) chartDaily.destroy();
    chartDaily=new Chart(document.getElementById('chart-daily'),{type:'bar',data:{labels:dl,datasets:[{label:'Sales',data:dc,backgroundColor:dl.map((_,i)=>i===new Date().getDay()?'#06b6d4':'rgba(139,92,246,.5)'),borderRadius:8,borderSkipped:false}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:TC},grid:{color:GC}},y:{ticks:{color:TC,stepSize:1},grid:{color:GC},beginAtZero:true}}}});
}

// ── PATTERN ANALYZER ─────────────────────────────────────
function analyzePatterns() {
    const grid=document.getElementById('insight-grid');
    if(!sales.length){grid.innerHTML='<div class="insight-placeholder">Add some sales to see patterns emerge...</div>';return;}
    const totalRev=sales.reduce((s,x)=>s+x.price*x.quantity,0);
    const catRev={};sales.forEach(s=>catRev[s.category]=(catRev[s.category]||0)+s.price*s.quantity);
    const topCat=Object.entries(catRev).sort((a,b)=>b[1]-a[1])[0];
    const now=new Date(),w1=new Date(now);w1.setDate(now.getDate()-7);
    const w2=new Date(now);w2.setDate(now.getDate()-14);
    const twR=sales.filter(s=>new Date(s.date)>=w1).reduce((a,s)=>a+s.price*s.quantity,0);
    const lwR=sales.filter(s=>new Date(s.date)>=w2&&new Date(s.date)<w1).reduce((a,s)=>a+s.price*s.quantity,0);
    const trend=lwR?(((twR-lwR)/lwR)*100).toFixed(1):null;
    const dc2=[0,0,0,0,0,0,0];sales.forEach(s=>dc2[new Date(s.date).getDay()]++);
    const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const peakDay=days[dc2.indexOf(Math.max(...dc2))];
    const catCnt={};sales.forEach(s=>catCnt[s.category]=(catCnt[s.category]||0)+1);
    const mostActive=Object.entries(catCnt).sort((a,b)=>b[1]-a[1])[0];
    const pct=((topCat[1]/totalRev)*100).toFixed(0);
    const insights=[
        {icon:'🏆',label:'Top Revenue Category',value:topCat[0],sub:`₹${topCat[1].toLocaleString('en-IN')} all-time`,color:'#8b5cf6'},
        {icon:trend&&parseFloat(trend)>=0?'📈':'📉',label:'Weekly Trend',value:trend?`${parseFloat(trend)>=0?'+':''}${trend}%`:'First week!',sub:`₹${twR.toLocaleString('en-IN')} this week vs ₹${lwR.toLocaleString('en-IN')} last`,color:(!trend||parseFloat(trend)>=0)?'#10b981':'#ef4444'},
        {icon:'⏰',label:'Peak Sales Day',value:peakDay,sub:`${dc2[days.indexOf(peakDay)]} sale(s)`,color:'#06b6d4'},
        {icon:'💰',label:'Avg. Order Value',value:`₹${(totalRev/sales.length).toFixed(0)}`,sub:`Across ${sales.length} total items`,color:'#f59e0b'},
        {icon:'🔥',label:'Most Active Category',value:mostActive[0],sub:`${mostActive[1]} sale(s) recorded`,color:'#f97316'},
        {icon:'💡',label:'Recommendation',value:'Insight',sub:`${topCat[0]} drives ${pct}% of revenue.${parseInt(pct)>50?' Consider diversifying.':' Growing other categories could boost income.'}`,color:'#3b82f6',wide:true}
    ];
    grid.innerHTML=insights.map(i=>`<div class="insight-card${i.wide?' insight-wide':''}" style="border-left-color:${i.color}"><div class="insight-icon">${i.icon}</div><div class="insight-body"><div class="insight-label">${i.label}</div><div class="insight-value" style="color:${i.color}">${i.value}</div><div class="insight-sub">${i.sub}</div></div></div>`).join('');
}

// ── EDIT IMAGE MODAL ──────────────────────────────────────
const editImgOverlay=document.getElementById('edit-img-overlay');
const editImgDropzone=document.getElementById('edit-img-dropzone');
const editImageInput=document.getElementById('edit-image-input');
const editPreviewImg=document.getElementById('edit-preview-img');
const editPreviewText=document.getElementById('edit-preview-text');
let editTargetSaleId=null, editImageBase64=null;
document.getElementById('close-edit-img-modal').onclick=()=>editImgOverlay.style.display='none';
editImgDropzone.onclick=()=>editImageInput.click();
editImageInput.onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=ev=>{editImageBase64=ev.target.result;editPreviewImg.src=editImageBase64;editPreviewImg.style.display='block';editPreviewText.style.display='none';};r.readAsDataURL(f);
};
window.openEditImageModal=id=>{editTargetSaleId=id;editImageBase64=null;editPreviewImg.src='';editPreviewImg.style.display='none';editPreviewText.style.display='block';editImageInput.value='';editImgOverlay.style.display='flex';};
document.getElementById('save-img-btn').onclick=async()=>{
    if(!editImageBase64){showToast('Please select an image.','error');return;}
    try{
        const r=await fetch(`${API_BASE}/sales/${editTargetSaleId}/image`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:editImageBase64})});
        if(r.ok){editImgOverlay.style.display='none';await fetchSales();setSelectedDate(selectedDate);showToast('Image updated.');}
        else showToast('Failed to update image.','error');
    }catch{showToast('Connection failed.','error');}
};

window.deleteSale=async id=>{
    if(!confirm('Delete this sale?'))return;
    try{const r=await fetch(`${API_BASE}/sales/${id}`,{method:'DELETE'});if(r.ok){await fetchSales();setSelectedDate(selectedDate);showToast('Deleted.');}else showToast('Error.','error');}
    catch{showToast('Connection failed.','error');}
};

// ── START ─────────────────────────────────────────────────
init();
