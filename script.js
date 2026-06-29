(function() {
  const STORAGE_PRODUCTS = 'ckp_ministore_products';
  const STORAGE_CART = 'ckp_ministore_cart';
  const STORAGE_TRANSACTIONS = 'ckp_ministore_transactions';
  const STORAGE_UTANG = 'ckp_ministore_utang';

  let products = {};
  let cart = [];
  let transactions = [];
  let utangRecords = [];
  let sellScannerActive = false;
  let registerScannerActive = false;
  let registerMode = 'barcode';
  let lastScannedBarcode = '';
  let lastScanTime = 0;
  const SCAN_COOLDOWN = 1200;
  let audioContext = null;

  // DOM Elements
  const tabButtons = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const scannerContainer = document.getElementById('scannerContainer');
  const scannerVideo = document.getElementById('scannerVideo');
  const toggleScannerBtn = document.getElementById('toggleScannerBtn');
  const scanStatus = document.getElementById('scanStatus');
  const productSearchSell = document.getElementById('productSearchSell');
  const searchResults = document.getElementById('searchResults');
  const editBarcode = document.getElementById('editBarcode');
  const editName = document.getElementById('editName');
  const editPrice = document.getElementById('editPrice');
  const editQty = document.getElementById('editQty');
  const addToCartBtn = document.getElementById('addToCartBtn');
  const cartContainer = document.getElementById('cartContainer');
  const totalDisplay = document.getElementById('totalDisplay');
  const paymentInput = document.getElementById('paymentInput');
  const calculateChangeBtn = document.getElementById('calculateChangeBtn');
  const changeDisplay = document.getElementById('changeDisplay');
  const changeAmount = document.getElementById('changeAmount');
  const completeTransactionBtn = document.getElementById('completeTransactionBtn');
  const resetCartBtn = document.getElementById('resetCartBtn');
  const registerScannerContainer = document.getElementById('registerScannerContainer');
  const registerScannerVideo = document.getElementById('registerScannerVideo');
  const startRegisterScannerBtn = document.getElementById('startRegisterScannerBtn');
  const stopRegisterScannerBtn = document.getElementById('stopRegisterScannerBtn');
  const registerBarcode = document.getElementById('registerBarcode');
  const registerCustomId = document.getElementById('registerCustomId');
  const registerName = document.getElementById('registerName');
  const registerPrice = document.getElementById('registerPrice');
  const registerStock = document.getElementById('registerStock');
  const saveProductBtn = document.getElementById('saveProductBtn');
  const registerMessage = document.getElementById('registerMessage');
  const typeBtns = document.querySelectorAll('.type-btn');
  const productListContainer = document.getElementById('productListContainer');
  const productSearch = document.getElementById('productSearch');
  const clearProductsBtn = document.getElementById('clearProductsBtn');
  const utangNameInput = document.getElementById('utangName');
  const addUtangBtn = document.getElementById('addUtangBtn');
  const utangLogContainer = document.getElementById('utangLogContainer');
  const transactionLogContainer = document.getElementById('transactionLogContainer');
  const clearUtangLogBtn = document.getElementById('clearUtangLogBtn');
  const clearTransactionsBtn = document.getElementById('clearTransactionsBtn');
  const clearCartOnlyBtn = document.getElementById('clearCartOnlyBtn');
  const resetAllDataBtn = document.getElementById('resetAllDataBtn');
  const downloadUtangBtn = document.getElementById('downloadUtangBtn');
  const downloadTransactionsBtn = document.getElementById('downloadTransactionsBtn');
  const toggleUtangBtn = document.getElementById('toggleUtangBtn');
  const toggleTransactionsBtn = document.getElementById('toggleTransactionsBtn');
  const utangSection = document.getElementById('utangSection');
  const transactionsSection = document.getElementById('transactionsSection');
  const backupDataBtn = document.getElementById('backupDataBtn');
  const restoreDataBtn = document.getElementById('restoreDataBtn');
  const restoreFileInput = document.getElementById('restoreFileInput');

  function playBeep(type = 'success') {
    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain); gain.connect(audioContext.destination);
      if (type === 'success') { osc.type='sine'; osc.frequency.setValueAtTime(880,now); osc.frequency.setValueAtTime(1100,now+0.08); gain.gain.setValueAtTime(0.3,now); gain.gain.exponentialRampToValueAtTime(0.01,now+0.2); osc.start(now); osc.stop(now+0.2); }
      else if (type === 'error') { osc.type='square'; osc.frequency.setValueAtTime(200,now); gain.gain.setValueAtTime(0.2,now); gain.gain.exponentialRampToValueAtTime(0.01,now+0.3); osc.start(now); osc.stop(now+0.3); }
      else if (type === 'add') { osc.type='sine'; osc.frequency.setValueAtTime(660,now); gain.gain.setValueAtTime(0.2,now); gain.gain.exponentialRampToValueAtTime(0.01,now+0.1); osc.start(now); osc.stop(now+0.1); }
      else if (type === 'complete') { osc.type='sine'; osc.frequency.setValueAtTime(523,now); osc.frequency.setValueAtTime(659,now+0.1); osc.frequency.setValueAtTime(784,now+0.2); gain.gain.setValueAtTime(0.25,now); gain.gain.exponentialRampToValueAtTime(0.01,now+0.4); osc.start(now); osc.stop(now+0.4); }
    } catch (e) {}
  }

  function loadFromStorage() {
    try { products=JSON.parse(localStorage.getItem(STORAGE_PRODUCTS))||{}; cart=JSON.parse(localStorage.getItem(STORAGE_CART))||[]; transactions=JSON.parse(localStorage.getItem(STORAGE_TRANSACTIONS))||[]; utangRecords=JSON.parse(localStorage.getItem(STORAGE_UTANG))||[]; }
    catch(e){ products={}; cart=[]; transactions=[]; utangRecords=[]; }
  }

  function saveAll() {
    localStorage.setItem(STORAGE_PRODUCTS,JSON.stringify(products));
    localStorage.setItem(STORAGE_CART,JSON.stringify(cart));
    localStorage.setItem(STORAGE_TRANSACTIONS,JSON.stringify(transactions));
    localStorage.setItem(STORAGE_UTANG,JSON.stringify(utangRecords));
  }

  function switchTab(tabName) {
    tabButtons.forEach(t=>t.classList.remove('active'));
    tabContents.forEach(c=>c.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`${tabName}Tab`)?.classList.add('active');
    if(tabName!=='scan') stopSellScanner();
    if(tabName!=='register') stopRegisterScanner();
    if(tabName==='products') renderProductList();
    if(tabName==='scan' && !sellScannerActive) startSellScanner();
  }

  tabButtons.forEach(t=>t.addEventListener('click',()=>switchTab(t.getAttribute('data-tab'))));

  // Toggle sections
  function toggleSection(section, btn, label) {
    if(section.style.display==='none') { section.style.display='block'; btn.textContent=label+' ▾'; }
    else { section.style.display='none'; btn.textContent=label+' ▸'; }
  }

  // ============ SCANNER ============
  async function startSellScanner() {
    if(sellScannerActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:640},height:{ideal:480}}});
      scannerVideo.srcObject=stream;
      scannerContainer.classList.add('active');
      sellScannerActive=true;
      scanStatus.textContent='🔍 Scanning...';
      await new Promise(r=>{scannerVideo.onloadedmetadata=()=>{scannerVideo.play();r();};});
      continuousScanLoop();
    } catch(e){ scanStatus.textContent='❌ Camera denied'; }
  }

  async function continuousScanLoop() {
    if(!sellScannerActive) return;
    if('BarcodeDetector' in window) {
      const bd = new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39','code_93','codabar','itf']});
      while(sellScannerActive) {
        try { if(scannerVideo.readyState>=2) { const bcs=await bd.detect(scannerVideo); if(bcs.length>0) { handleAutoScan(bcs[0].rawValue); await new Promise(r=>setTimeout(r,SCAN_COOLDOWN)); } } } catch(e){}
        await new Promise(r=>setTimeout(r,80));
      }
    } else {
      const cr = new ZXing.BrowserMultiFormatReader();
      while(sellScannerActive) {
        try { if(scannerVideo.readyState>=2) { const r=await cr.decodeOnceFromVideoDevice(null,scannerVideo); if(r&&r.text) { handleAutoScan(r.text); await new Promise(r=>setTimeout(r,SCAN_COOLDOWN)); } } } catch(e){}
        await new Promise(r=>setTimeout(r,120));
      }
      cr.reset();
    }
  }

  function handleAutoScan(barcode) {
    const now=Date.now();
    if(barcode===lastScannedBarcode&&now-lastScanTime<SCAN_COOLDOWN) return;
    if(barcode!==lastScannedBarcode) lastScanTime=0;
    lastScannedBarcode=barcode; lastScanTime=now;
    
    if(navigator.vibrate) navigator.vibrate([30,20,30]);
    
    const product=lookupByBarcode(barcode);
    
    if(product) {
      if(product.stock !== undefined && product.stock <= 0) {
        playBeep('error');
        scanStatus.textContent=`⚠️ Out of stock: ${product.name}`;
        scannerContainer.style.boxShadow='0 0 20px rgba(255,152,0,0.8)';
        setTimeout(()=>scannerContainer.style.boxShadow='none',400);
        setTimeout(()=>{if(sellScannerActive)scanStatus.textContent='🔍 Scanning...';},1500);
        return;
      }
      
      playBeep('success');
      autoAddToCart(product);
      scannerContainer.style.boxShadow='0 0 20px rgba(76,175,80,0.8)';
      setTimeout(()=>scannerContainer.style.boxShadow='none',400);
      scanStatus.textContent=`✅ Added: ${product.name}`;
    } else {
      playBeep('error');
      scannerContainer.style.boxShadow='0 0 20px rgba(244,67,54,0.8)';
      setTimeout(()=>scannerContainer.style.boxShadow='none',400);
      scanStatus.textContent=`❌ Not registered: ${barcode}`;
      editBarcode.value=barcode;
      editName.value='';
      editPrice.value='';
    }
    
    setTimeout(()=>{if(sellScannerActive)scanStatus.textContent='🔍 Scanning...';},1500);
  }

  function autoAddToCart(product) {
    const existing=cart.findIndex(i=>i.productId===product.id);
    if(existing!==-1) {
      if(product.stock !== undefined && cart[existing].qty >= product.stock) {
        scanStatus.textContent=`⚠️ Only ${product.stock} in stock`;
        setTimeout(()=>{if(sellScannerActive)scanStatus.textContent='🔍 Scanning...';},1500);
        return;
      }
      cart[existing].qty+=1;
    } else {
      cart.push({id:Date.now(),productId:product.id,name:product.name,price:parseFloat(product.price),qty:1});
    }
    saveAll();
    renderCart();
    resetPaymentAndChange();
  }

  function toggleScanner() { if(sellScannerActive) stopSellScanner(); else startSellScanner(); }

  function stopSellScanner() {
    sellScannerActive=false;
    if(scannerVideo.srcObject){scannerVideo.srcObject.getTracks().forEach(t=>t.stop());scannerVideo.srcObject=null;}
    scannerContainer.classList.remove('active');
    scanStatus.textContent='📷 Scanner off';
  }

  // ============ REGISTER SCANNER ============
  async function startRegisterScanner() {
    if(registerScannerActive||registerMode!=='barcode') return;
    try {
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:640},height:{ideal:480}}});
      registerScannerVideo.srcObject=stream;
      registerScannerContainer.classList.add('active');
      registerScannerActive=true; startRegisterScannerBtn.disabled=true; stopRegisterScannerBtn.disabled=false;
      await new Promise(r=>{registerScannerVideo.onloadedmetadata=()=>{registerScannerVideo.play();r();};});
      continuousRegisterScan();
    } catch(e){ alert('Cannot access camera.'); stopRegisterScanner(); }
  }

  async function continuousRegisterScan() {
    if(!registerScannerActive) return;
    if('BarcodeDetector' in window) {
      const bd=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39']});
      while(registerScannerActive){try{if(registerScannerVideo.readyState>=2){const bcs=await bd.detect(registerScannerVideo);if(bcs.length>0){handleRegisterScan(bcs[0].rawValue);await new Promise(r=>setTimeout(r,1000));}}}catch(e){}await new Promise(r=>setTimeout(r,80));}
    } else {
      const cr=new ZXing.BrowserMultiFormatReader();
      while(registerScannerActive){try{if(registerScannerVideo.readyState>=2){const r=await cr.decodeOnceFromVideoDevice(null,registerScannerVideo);if(r&&r.text){handleRegisterScan(r.text);await new Promise(r=>setTimeout(r,1000));}}}catch(e){}await new Promise(r=>setTimeout(r,120));}
      cr.reset();
    }
  }

  function handleRegisterScan(barcode) {
    registerBarcode.value=barcode; playBeep('success');
    const existing=lookupByBarcode(barcode);
    if(existing){registerName.value=existing.name;registerPrice.value=existing.price;registerStock.value=existing.stock||0;showMessage('Exists! You can update.','success');}
    else{showMessage('New barcode!','success');}
  }

  function stopRegisterScanner() {
    registerScannerActive=false;
    if(registerScannerVideo.srcObject){registerScannerVideo.srcObject.getTracks().forEach(t=>t.stop());registerScannerVideo.srcObject=null;}
    registerScannerContainer.classList.remove('active');
    startRegisterScannerBtn.disabled=false; stopRegisterScannerBtn.disabled=true;
  }

  typeBtns.forEach(btn=>{btn.addEventListener('click',()=>{typeBtns.forEach(b=>b.classList.remove('active'));btn.classList.add('active');registerMode=btn.getAttribute('data-type');if(registerMode==='barcode'){document.getElementById('registerScannerArea').style.display='block';document.getElementById('barcodeField').style.display='flex';document.getElementById('customIdField').style.display='none';}else{document.getElementById('registerScannerArea').style.display='none';document.getElementById('barcodeField').style.display='none';document.getElementById('customIdField').style.display='flex';stopRegisterScanner();}});});

  function searchProducts(query) {
    const q=query.toLowerCase().trim();const r=[];
    Object.entries(products).forEach(([id,d])=>{if(d.name.toLowerCase().includes(q)||id.toLowerCase().includes(q)||(d.barcode&&d.barcode.includes(q)))r.push({id,...d});});
    return r.slice(0,10);
  }

  function renderSearchResults(query) {
    const results=searchProducts(query);
    if(!results.length){searchResults.innerHTML='';return;}
    searchResults.innerHTML=results.map(p=>{
      const stockInfo = p.stock !== undefined ? ` (Stock: ${p.stock})` : '';
      return `<div class="search-result-item" data-id="${escapeHtml(p.id)}"><span>${escapeHtml(p.name)}${stockInfo}</span><span>₱${parseFloat(p.price).toFixed(2)}</span></div>`;
    }).join('');
    document.querySelectorAll('.search-result-item').forEach(item=>item.addEventListener('click',()=>{
      const p=products[item.getAttribute('data-id')];
      if(p){
        if(p.stock !== undefined && p.stock <= 0) { alert('Out of stock!'); return; }
        autoAddToCart(p);searchResults.innerHTML='';productSearchSell.value='';
      }
    }));
  }

  function lookupByBarcode(barcode){for(const[id,d]of Object.entries(products)){if(d.barcode===barcode)return{id,...d};}return null;}

  function saveProduct(){
    const name=registerName.value.trim(),price=parseFloat(registerPrice.value),stock=parseInt(registerStock.value)||0;
    if(!name){showMessage('Enter name','error');return;}
    if(isNaN(price)||price<0){showMessage('Enter valid price','error');return;}
    let pid,bc=null;
    if(registerMode==='barcode'){bc=registerBarcode.value.trim();if(!bc){showMessage('Enter barcode','error');return;}pid=bc;}
    else{pid=registerCustomId.value.trim()||'ITEM_'+Date.now();}
    products[pid]={name,price,barcode:bc,hasBarcode:registerMode==='barcode',stock};
    saveAll();playBeep('add');showMessage(`✅ ${name} saved!`,'success');
    registerBarcode.value='';registerCustomId.value='';registerName.value='';registerPrice.value='';registerStock.value='0';
  }

  function showMessage(m,t){registerMessage.textContent=m;registerMessage.className=`message ${t}`;setTimeout(()=>registerMessage.className='message',2000);}

  function manualAddToCart(){
    const name=editName.value.trim();
    const barcode=editBarcode.value.trim();
    const price=parseFloat(editPrice.value)||0;
    const qty=Math.max(1,parseInt(editQty.value)||1);
    if(!barcode&&!name){alert('Enter barcode or name');return;}
    const productId=barcode||'CUSTOM_'+Date.now();
    if(name&&price>0){products[productId]={name,price,barcode:barcode||null,hasBarcode:!!barcode,stock:0};saveAll();}
    const product=products[productId];
    if(product&&product.stock!==undefined&&product.stock<=0){alert('Out of stock!');return;}
    const existing=cart.findIndex(i=>i.productId===productId);
    if(existing!==-1){cart[existing].qty+=qty;}
    else{cart.push({id:Date.now(),productId,name:name||barcode,price,qty});}
    saveAll();renderCart();playBeep('add');
    editBarcode.value='';editName.value='';editPrice.value='';editQty.value=1;
    resetPaymentAndChange();
  }

  function updateCartQty(idx,qty){
    const newQty=Math.max(1,parseInt(qty)||1);
    const item=cart[idx];
    const product=products[item.productId];
    if(product&&product.stock!==undefined&&newQty>product.stock){alert(`Only ${product.stock} in stock!`);return;}
    cart[idx].qty=newQty;
    saveAll();renderCart();resetPaymentAndChange();
  }

  function removeCartItem(idx){cart.splice(idx,1);saveAll();renderCart();resetPaymentAndChange();}
  function calculateTotal(){return cart.reduce((s,i)=>s+(i.price*i.qty),0);}

  function renderCart(){
    if(!cart.length){cartContainer.innerHTML='<div class="empty-state-mini">Cart empty</div>';totalDisplay.textContent='₱0.00';return;}
    cartContainer.innerHTML=cart.map((item,i)=>`
      <div class="cart-item-mini">
        <span style="flex:1;font-size:0.7rem;">${escapeHtml(item.name||item.productId)}</span>
        <div class="cart-edit-inline">
          <button class="qty-mini-btn" data-idx="${i}" data-d="-">−</button>
          <input class="qty-mini-input" value="${item.qty}" data-idx="${i}">
          <button class="qty-mini-btn" data-idx="${i}" data-d="+">+</button>
          <span style="font-weight:700;min-width:45px;text-align:right;">₱${(item.price*item.qty).toFixed(2)}</span>
          <button class="remove-mini" data-idx="${i}">✕</button>
        </div>
      </div>
    `).join('');
    totalDisplay.textContent=`₱${calculateTotal().toFixed(2)}`;
    document.querySelectorAll('.qty-mini-btn').forEach(b=>b.addEventListener('click',()=>{
      const idx=parseInt(b.dataset.idx),d=b.dataset.d;
      updateCartQty(idx,d==='+'?cart[idx].qty+1:cart[idx].qty-1);
    }));
    document.querySelectorAll('.qty-mini-input').forEach(i=>i.addEventListener('change',()=>updateCartQty(parseInt(i.dataset.idx),i.value)));
    document.querySelectorAll('.remove-mini').forEach(b=>b.addEventListener('click',()=>removeCartItem(parseInt(b.dataset.idx))));
  }

  // ============ REAL-TIME CHANGE CALCULATION ============
  function resetPaymentAndChange() {
    paymentInput.value = '';
    changeDisplay.style.display = 'none';
  }

  function updateChangeDisplay() {
    const total = calculateTotal();
    if (cart.length === 0) {
      changeDisplay.style.display = 'none';
      return;
    }
    const payment = parseFloat(paymentInput.value);
    if (isNaN(payment) || payment < total) {
      changeDisplay.style.display = 'none';
      return;
    }
    const change = payment - total;
    changeAmount.textContent = `₱${change.toFixed(2)}`;
    changeDisplay.style.display = 'flex';
  }

  // Button still works but real-time is handled by input event
  function calculateChangeBtnClick() {
    updateChangeDisplay();
    if (changeDisplay.style.display === 'flex') playBeep('add');
  }

  function completeTransaction(){
    if(!cart.length){alert('Cart empty');return;}
    const total=calculateTotal();
    const payment=parseFloat(paymentInput.value)||0;
    if(payment<total){alert(`Payment must be at least ₱${total.toFixed(2)}`);return;}
    const change=payment-total;
    cart.forEach(item=>{
      const product=products[item.productId];
      if(product&&product.stock!==undefined){product.stock=Math.max(0,product.stock-item.qty);}
    });
    transactions.unshift({id:Date.now(),time:new Date().toLocaleString(),items:cart.map(i=>({...i})),total,payment,change});
    cart=[];saveAll();renderCart();renderTransactionLog();renderProductList();playBeep('complete');
    paymentInput.value='';changeDisplay.style.display='none';
    alert(`✅ Sale complete!\nChange: ₱${change.toFixed(2)}`);
  }

  // ============ BACKUP & RESTORE ============
  function backupAllData() {
    const allData = {products, transactions, utangRecords, exportedAt: new Date().toISOString()};
    const json = JSON.stringify(allData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ministore_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    playBeep('add');
  }

  function restoreAllData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (data.products) products = data.products;
        if (data.transactions) transactions = data.transactions;
        if (data.utangRecords) utangRecords = data.utangRecords;
        saveAll();
        renderCart();renderTransactionLog();renderUtangLog();renderProductList();
        alert('✅ Data restored successfully!');
        playBeep('add');
      } catch (err) { alert('❌ Invalid backup file.'); }
    };
    reader.readAsText(file);
  }

  // ============ DOWNLOAD ============
  function downloadXLSX(filename, sheets) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    sheets.forEach(sheet => { xml += '<Worksheet ss:Name="'+sheet.name+'"><Table>'; sheet.rows.forEach(row=>{ xml+='<Row>'; row.forEach(cell=>{ xml+='<Cell><Data ss:Type="String">'+escapeXml(String(cell))+'</Data></Cell>'; }); xml+='</Row>'; }); xml+='</Table></Worksheet>'; });
    xml += '</Workbook>';
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=filename; link.click(); URL.revokeObjectURL(link.href);
  }
  function escapeXml(str){return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function downloadTransactions(){
    if(!transactions.length){alert('No transactions');return;}
    const rows=[['Date/Time','Items','Total','Payment','Change']];
    transactions.forEach(tx=>rows.push([tx.time,tx.items.map(i=>`${i.name} x${i.qty} @₱${i.price.toFixed(2)}`).join('; '),'₱'+tx.total.toFixed(2),'₱'+(tx.payment||0).toFixed(2),'₱'+(tx.change||0).toFixed(2)]));
    downloadXLSX(`Transactions_${new Date().toISOString().split('T')[0]}.xls`,[{name:'Transactions',rows}]);
  }
  function downloadUtang(){
    if(!utangRecords.length){alert('No utang records');return;}
    const rows=[['Customer Name','Date','Items','Total']];
    utangRecords.forEach(r=>rows.push([r.name,r.time,r.items.map(i=>`${i.name} x${i.qty} @₱${i.price.toFixed(2)}`).join('; '),'₱'+r.total.toFixed(2)]));
    downloadXLSX(`Utang_${new Date().toISOString().split('T')[0]}.xls`,[{name:'Utang',rows}]);
  }

  function clearCartOnly(){if(cart.length&&confirm('Clear cart?')){cart=[];saveAll();renderCart();resetPaymentAndChange();}}
  function clearTransactions(){if(transactions.length&&confirm('Clear transactions?')){transactions=[];saveAll();renderTransactionLog();}}
  function clearUtangLog(){if(utangRecords.length&&confirm('Clear utang?')){utangRecords=[];saveAll();renderUtangLog();}}
  function clearAllProducts(){if(Object.keys(products).length&&confirm('Delete all products?')){products={};saveAll();renderProductList();}}
  function resetAllData(){if(confirm('⚠️ DELETE EVERYTHING?')){stopSellScanner();stopRegisterScanner();products={};cart=[];transactions=[];utangRecords=[];saveAll();location.reload();}}

  function addUtangRecord(){
    const name=utangNameInput.value.trim();
    if(!name){alert('Enter name');return;}
    if(!cart.length){alert('Cart empty');return;}
    cart.forEach(item=>{const product=products[item.productId];if(product&&product.stock!==undefined){product.stock=Math.max(0,product.stock-item.qty);}});
    utangRecords.unshift({id:Date.now(),name,items:cart.map(i=>({...i})),total:calculateTotal(),time:new Date().toLocaleString()});
    cart=[];saveAll();renderCart();renderUtangLog();renderProductList();utangNameInput.value='';playBeep('add');
    alert(`📋 Utang for ${name}`);
  }

  function renderUtangLog(){utangLogContainer.innerHTML=utangRecords.length?utangRecords.map(r=>`<div><strong>${escapeHtml(r.name)}</strong> · ${r.time} · ₱${r.total.toFixed(2)}</div>`).join(''):'<div>No records</div>';}
  function renderTransactionLog(){transactionLogContainer.innerHTML=transactions.length?transactions.map(t=>`<div>${t.time} · ${t.items.map(i=>i.name+' x'+i.qty).join(', ')} · ₱${t.total.toFixed(2)}${t.payment?' · Paid:₱'+t.payment.toFixed(2):''}${t.change?' · Change:₱'+t.change.toFixed(2):''}</div>`).join(''):'<div>No transactions</div>';}

  function getStockClass(stock){if(stock===undefined)return'';if(stock<=0)return'stock-out';if(stock<=5)return'stock-low';if(stock<=20)return'stock-medium';return'stock-high';}
  function renderProductList(st=''){
    const entries=Object.entries(products);
    if(!entries.length){productListContainer.innerHTML='<div class="empty-state">No products</div>';return;}
    const q=st.toLowerCase();
    const f=entries.filter(([id,d])=>d.name.toLowerCase().includes(q)||id.toLowerCase().includes(q)||(d.barcode&&d.barcode.includes(q)));
    productListContainer.innerHTML=f.map(([id,d])=>`<div class="product-item"><div style="flex:1;"><strong>${escapeHtml(d.name)}</strong><br><small>${escapeHtml(d.barcode||id)}</small></div><span class="product-stock ${getStockClass(d.stock)}">Stock: ${d.stock!==undefined?d.stock:'-'}</span><span style="font-weight:700;margin:0 6px;">₱${parseFloat(d.price).toFixed(2)}</span><button class="remove-mini" data-pid="${escapeHtml(id)}">✕</button></div>`).join('')||'<div class="empty-state">No matches</div>';
    document.querySelectorAll('.product-item .remove-mini').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const id=b.dataset.pid;if(confirm(`Delete ${products[id]?.name}?`)){delete products[id];saveAll();renderProductList(productSearch.value);}}));
  }

  function escapeHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}

  function init(){
    loadFromStorage();renderCart();renderTransactionLog();renderUtangLog();renderProductList();
    setTimeout(()=>startSellScanner(),800);
    
    toggleUtangBtn.addEventListener('click',()=>toggleSection(utangSection,toggleUtangBtn,'📋 Utang'));
    toggleTransactionsBtn.addEventListener('click',()=>toggleSection(transactionsSection,toggleTransactionsBtn,'🧾 Transactions'));
    toggleScannerBtn.addEventListener('click',toggleScanner);
    productSearchSell.addEventListener('input',e=>renderSearchResults(e.target.value));
    addToCartBtn.addEventListener('click',manualAddToCart);
    calculateChangeBtn.addEventListener('click',calculateChangeBtnClick);
    completeTransactionBtn.addEventListener('click',completeTransaction);
    resetCartBtn.addEventListener('click',clearCartOnly);
    saveProductBtn.addEventListener('click',saveProduct);
    startRegisterScannerBtn.addEventListener('click',startRegisterScanner);
    stopRegisterScannerBtn.addEventListener('click',stopRegisterScanner);
    productSearch.addEventListener('input',e=>renderProductList(e.target.value));
    clearProductsBtn.addEventListener('click',clearAllProducts);
    addUtangBtn.addEventListener('click',addUtangRecord);
    clearUtangLogBtn.addEventListener('click',clearUtangLog);
    clearTransactionsBtn.addEventListener('click',clearTransactions);
    clearCartOnlyBtn.addEventListener('click',clearCartOnly);
    resetAllDataBtn.addEventListener('click',resetAllData);
    downloadTransactionsBtn.addEventListener('click',downloadTransactions);
    downloadUtangBtn.addEventListener('click',downloadUtang);
    
    // Real-time change display
    paymentInput.addEventListener('input', updateChangeDisplay);
    paymentInput.addEventListener('keydown', e => { if(e.key==='Enter'){ e.preventDefault(); completeTransaction(); } });
    
    // Backup & Restore
    backupDataBtn.addEventListener('click', backupAllData);
    restoreDataBtn.addEventListener('click', ()=>restoreFileInput.click());
    restoreFileInput.addEventListener('change', e => {
      if(e.target.files.length>0){ if(confirm('Restore data? This will overwrite current products, transactions, and utang records.')) restoreAllData(e.target.files[0]); e.target.value=''; }
    });
    
    editQty.addEventListener('change',()=>{if(editQty.value<1)editQty.value=1;});
    window.addEventListener('beforeunload',()=>{stopSellScanner();stopRegisterScanner();});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();