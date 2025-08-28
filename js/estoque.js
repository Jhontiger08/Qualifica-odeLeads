import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCTAaa5sF_O4S38FpyV_mL2hpB0xGXgAv4", authDomain: "qualificacao-a14ff.firebaseapp.com", projectId: "qualificacao-a14ff", storageBucket: "qualificacao-a14ff.appspot.com", messagingSenderId: "955642076737", appId: "1:955642076737:web:f6db77134cd6a18b8f30c0" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        const authCheckDiv = document.getElementById('auth-check');
        const accessDeniedDiv = document.getElementById('access-denied');
        const estoqueAppDiv = document.getElementById('estoque-app');

        if (user) {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'caixa')) {
                    authCheckDiv.classList.add('hidden');
                    estoqueAppDiv.classList.remove('hidden');
                    initializeAppPDV(user, userDoc.data());
                } else {
                    throw new Error('Permissão insuficiente.');
                }
            } catch (error) {
                console.error("Erro de autorização:", error);
                authCheckDiv.classList.add('hidden');
                accessDeniedDiv.classList.remove('hidden');
            }
        } else {
            authCheckDiv.classList.add('hidden');
            accessDeniedDiv.classList.remove('hidden');
        }
    });
});

function initializeAppPDV(user, userData) {
    // --- Variáveis de Estado ---
    let allProducts = [], allClients = [], allIptvClients = [], allMovimentacoes = [];
    let currentSale = [], currentEditingProductId = null, currentEditingIptvId = null, currentEditingClientId = null, vencimentoMsg = '';

    // --- Seletores de DOM ---
    const productModal = document.getElementById('productModal');
    const showModal = (modal) => modal.classList.remove('hidden');
    const hideModal = (modal) => modal.classList.add('hidden');
    const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatDate = (date) => date ? new Date(date.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';

    // --- NAVEGAÇÃO ---
    document.querySelectorAll('.pdv-tab').forEach(tab => {
        tab.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.pdv-tab').forEach(t => { t.classList.remove('border-blue-500', 'text-blue-600'); t.classList.add('border-transparent', 'text-gray-500'); });
            tab.classList.add('border-blue-500', 'text-blue-600');
            document.querySelectorAll('.pdv-section').forEach(s => s.classList.add('hidden'));
            document.getElementById(tab.id.replace('tab-', '') + '-content').classList.remove('hidden');
        });
    });

    // --- RENDERIZAÇÃO ---
    const renderTable = (tbodyId, data, rowTemplate, emptyMsg) => {
        const tbody = document.getElementById(tbodyId);
        tbody.innerHTML = data.length > 0 ? data.map(rowTemplate).join('') : `<tr><td colspan="10" class="text-center p-4 text-gray-500">${emptyMsg}</td></tr>`;
    };

    const renderProductsTable = (products) => renderTable('products-table-body', products, p => `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-3">${p.code || p.id.slice(-6)}</td>
            <td class="p-3 font-medium">${p.nome}</td>
            <td class="p-3 text-center font-bold ${p.estoqueAtual <= p.estoqueMinimo ? 'text-red-500' : 'text-gray-700'}">${p.estoqueAtual || 0}</td>
            <td class="p-3 text-right">${formatCurrency(p.precoVenda)}</td>
            <td class="p-3 text-right">${formatCurrency(p.custoCompra)}</td>
            <td class="p-3 text-center">
                <button data-id="${p.id}" class="edit-product-btn text-blue-600 hover:text-blue-800 p-1"><i class="fas fa-pencil-alt"></i></button>
                <button data-id="${p.id}" class="delete-product-btn text-red-500 hover:text-red-700 p-1"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>`, 'Nenhum produto cadastrado.');

    const renderClientsTable = (clients) => renderTable('clients-table-body', clients, c => `
        <tr class="border-b hover:bg-gray-50"><td class="p-2">${c.nome}</td><td class="p-2">${c.cpf || ''}</td><td class="p-2">${c.telefone || ''}</td><td class="p-2 text-center"><button data-id="${c.id}" class="edit-client-btn text-blue-600 p-1"><i class="fas fa-pencil-alt"></i></button><button data-id="${c.id}" class="delete-client-btn text-red-500 p-1"><i class="fas fa-trash-alt"></i></button></td></tr>`, 'Nenhum cliente cadastrado.');

    const renderMovimentacoesTable = (movs) => renderTable('movimentacoes-table-body', movs, m => {
        const isEntrada = m.tipo === 'entrada';
        const isVenda = m.tipo === 'saida' && m.observacao.startsWith('Venda');
        const colorClass = isEntrada ? 'text-green-600' : (isVenda ? 'text-blue-600' : 'text-red-600');
        return `<tr class="border-b"><td class="p-3">${m.createdAt.toDate().toLocaleString('pt-BR')}</td><td class="p-3">${m.produtoNome}</td>
            <td class="p-3 font-medium ${colorClass}">${m.tipo}</td>
            <td class="p-3 text-center font-bold ${colorClass}">${isEntrada ? '+' : '-'}${m.quantidade}</td>
            <td class="p-3 text-gray-600">${m.observacao}</td></tr>`;
    }, 'Nenhuma movimentação registrada.');

    // --- PRODUTOS ---
    const openProductModal = (productId = null) => {
        const form = document.getElementById('product-modal-form'); form.reset(); currentEditingProductId = productId;
        const estoqueInput = document.getElementById('product-estoque-inicial'); estoqueInput.disabled = !!productId;
        if (productId) {
            document.getElementById('product-modal-title').textContent = 'Editar Produto';
            const p = allProducts.find(p => p.id === productId);
            if (p) {
                form['product-id'].value = p.id; form['product-code'].value = p.code || p.id.slice(-6); form['product-nome'].value = p.nome;
                form['product-custo'].value = p.custoCompra; form['product-preco-venda'].value = p.precoVenda;
                form['product-estoque-inicial'].value = p.estoqueAtual; form['product-estoque-minimo'].value = p.estoqueMinimo;
            }
        } else {
            document.getElementById('product-modal-title').textContent = 'Novo Produto';
            form['product-code'].value = 'P-' + Date.now().toString().slice(-6);
        }
        showModal(productModal);
    };
    const handleSaveProduct = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = { code: form['product-code'].value, nome: form['product-nome'].value.trim(), custoCompra: parseFloat(form['product-custo'].value), precoVenda: parseFloat(form['product-preco-venda'].value), estoqueMinimo: parseInt(form['product-estoque-minimo'].value) };
        const estoqueOriginal = currentEditingProductId ? (allProducts.find(p => p.id === currentEditingProductId)?.estoqueAtual || 0) : 0;
        const novoEstoque = parseInt(form['product-estoque-inicial'].value);
        let obs = '';
        if (currentEditingProductId) {
            const updateData = {...data};
            if (novoEstoque !== estoqueOriginal) {
                const diff = novoEstoque - estoqueOriginal;
                obs = `Ajuste manual: ${diff > 0 ? '+' : ''}${diff}`;
                updateData.estoqueAtual = novoEstoque;
            }
            await updateDoc(doc(db, 'produtos_estoque', currentEditingProductId), updateData);
        } else {
            data.estoqueAtual = novoEstoque; data.createdAt = serverTimestamp();
            const newDocRef = await addDoc(collection(db, 'produtos_estoque'), data);
            currentEditingProductId = newDocRef.id;
            obs = `Entrada inicial: +${data.estoqueAtual}`;
        }
        if (obs) await addDoc(collection(db, 'movimentacoes_estoque'), { produtoId: currentEditingProductId, produtoNome: data.nome, tipo: obs.includes('+') ? 'entrada' : 'saida', quantidade: Math.abs(parseInt(obs.split(': ')[1])), observacao: obs, createdAt: serverTimestamp() });
        hideModal(productModal);
    };

    // --- CLIENTES ---
    const handleSaveClient = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = { nome: form['client-nome'].value, cpf: form['client-cpf'].value, telefone: form['client-telefone'].value, email: form['client-email'].value };
        if (currentEditingClientId) {
            await updateDoc(doc(db, 'clientes_pdv', currentEditingClientId), data);
        } else {
            await addDoc(collection(db, 'clientes_pdv'), data);
        }
        form.reset();
        document.getElementById('client-form-title').textContent = 'Novo Cliente';
        currentEditingClientId = null;
    };
    const editClient = (clientId) => {
        const client = allClients.find(c => c.id === clientId);
        if (client) {
            currentEditingClientId = clientId;
            const form = document.getElementById('client-form');
            form['client-id'].value = client.id;
            form['client-nome'].value = client.nome;
            form['client-cpf'].value = client.cpf;
            form['client-telefone'].value = client.telefone;
            form['client-email'].value = client.email;
            document.getElementById('client-form-title').textContent = 'Editar Cliente';
            form['client-nome'].focus();
        }
    };

    // --- IPTV ---
    const renderIptvTable = (clients) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const sevenDaysFromNow = new Date(now);
        sevenDaysFromNow.setDate(now.getDate() + 7);
        renderTable('iptv-table-body', clients, c => {
            const vencimentoDate = c.vencimento.toDate();
            vencimentoDate.setHours(0, 0, 0, 0);
            let statusClass = 'vencimento-verde';
            if (vencimentoDate < now) statusClass = 'vencimento-vermelho';
            else if (vencimentoDate <= sevenDaysFromNow) statusClass = 'vencimento-amarelo';
            return `<tr class="${statusClass} border-b"><td class="p-2 font-medium">${c.nome}</td><td class="p-2">${c.telefone || ''}</td><td class="p-2 text-center font-bold">${vencimentoDate.toLocaleDateString('pt-BR')}</td><td class="p-2 text-center"><button data-id="${c.id}" class="edit-iptv-btn text-blue-600 p-1"><i class="fas fa-pencil-alt"></i></button><button data-id="${c.id}" class="delete-iptv-btn text-red-500 p-1"><i class="fas fa-trash-alt"></i></button></td></tr>`;
        }, 'Nenhum cliente IPTV cadastrado.');
    };
    const handleSaveIptv = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = { nome: form['iptv-nome'].value.trim(), telefone: form['iptv-telefone'].value, email: form['iptv-email'].value, login: form['iptv-login'].value, senha: form['iptv-senha'].value, vencimento: new Date(form['iptv-vencimento'].value + 'T12:00:00') };
        try {
            if (currentEditingIptvId) {
                await updateDoc(doc(db, 'iptv_clientes', currentEditingIptvId), data);
                alert('Cliente atualizado com sucesso!');
            } else {
                await addDoc(collection(db, 'iptv_clientes'), { ...data, createdAt: serverTimestamp() });
                alert('Cliente salvo com sucesso!');
            }
            form.reset(); document.getElementById('iptv-form-title').textContent = 'Novo Cliente IPTV'; currentEditingIptvId = null;
        } catch (error) { console.error("Erro ao salvar cliente IPTV:", error); alert("Ocorreu um erro ao salvar. Tente novamente."); }
    };
    const editIptv = (id) => {
        const client = allIptvClients.find(c => c.id === id);
        if (client) {
            currentEditingIptvId = id;
            const form = document.getElementById('iptv-form');
            form['iptv-id'].value = client.id; form['iptv-nome'].value = client.nome; form['iptv-telefone'].value = client.telefone; form['iptv-email'].value = client.email; form['iptv-login'].value = client.login; form['iptv-senha'].value = client.senha; form['iptv-vencimento'].value = client.vencimento.toDate().toISOString().split('T')[0];
            document.getElementById('iptv-form-title').textContent = 'Editar Cliente IPTV';
            form['iptv-nome'].focus();
        }
    };
    
    // --- VENDAS (PDV) ---
    const updateSaleTotals = () => {
        const subtotal = currentSale.reduce((acc, item) => acc + (item.quantity * item.precoVenda), 0);
        const receivedAmount = parseFloat(document.getElementById('received-input').value) || 0;
        const change = receivedAmount > subtotal ? receivedAmount - subtotal : 0;
        document.getElementById('subtotal-display').textContent = formatCurrency(subtotal);
        document.getElementById('total-display').textContent = formatCurrency(subtotal);
        document.getElementById('change-display').textContent = formatCurrency(change);
    };
    const renderSaleItems = () => {
        renderTable('sale-items-table-body', currentSale, item => `
            <tr class="border-b"><td class="p-2 font-medium">${item.nome}</td><td class="p-2"><div class="flex items-center justify-center gap-1"><button data-id="${item.id}" class="change-qty-btn bg-gray-200 w-6 h-6 rounded">-</button><input type="number" value="${item.quantity}" data-id="${item.id}" class="sale-item-qty w-12 text-center border rounded-md" min="1"><button data-id="${item.id}" class="change-qty-btn bg-gray-200 w-6 h-6 rounded">+</button></div></td><td class="p-2 text-right">${formatCurrency(item.precoVenda)}</td><td class="p-2 text-right font-bold">${formatCurrency(item.quantity * item.precoVenda)}</td><td class="p-2 text-center"><button data-id="${item.id}" class="remove-sale-item-btn text-red-500 p-1"><i class="fas fa-trash-alt"></i></button></td></tr>`, 'Nenhum item na venda.');
        updateSaleTotals();
    };
    const finalizeSale = async () => {
        if (currentSale.length === 0) { alert('Adicione pelo menos um item para finalizar a venda.'); return; }
        const finalizeBtn = document.getElementById('finalize-sale-btn');
        finalizeBtn.disabled = true; finalizeBtn.textContent = 'Processando...';
        try {
            await runTransaction(db, async (transaction) => {
                const saleId = doc(collection(db, 'vendas')).id;
                const stockUpdates = [];
                for (const item of currentSale) {
                    const productRef = doc(db, 'produtos_estoque', item.id);
                    const productDoc = await transaction.get(productRef);
                    if (!productDoc.exists()) throw new Error(`Produto ${item.nome} não encontrado.`);
                    const currentStock = productDoc.data().estoqueAtual;
                    if (currentStock < item.quantity) throw new Error(`Estoque insuficiente para "${item.nome}". Apenas ${currentStock} em estoque.`);
                    stockUpdates.push({ ref: productRef, newStock: currentStock - item.quantity });
                }
                const saleData = { id: saleId, items: currentSale, total: currentSale.reduce((acc, item) => acc + (item.quantity * item.precoVenda), 0), vendedor: document.getElementById('seller-select').value, metodoPagamento: document.getElementById('payment-method').value, createdAt: serverTimestamp() };
                transaction.set(doc(db, 'vendas', saleId), saleData);
                for (let i = 0; i < currentSale.length; i++) {
                    const item = currentSale[i];
                    const update = stockUpdates[i];
                    transaction.update(update.ref, { estoqueAtual: update.newStock });
                    const movRef = doc(collection(db, 'movimentacoes_estoque'));
                    transaction.set(movRef, { produtoId: item.id, produtoNome: item.nome, tipo: 'saida', quantidade: item.quantity, observacao: `Venda ID: ${saleId.slice(-6)}`, createdAt: serverTimestamp() });
                }
            });
            alert('Venda finalizada com sucesso!'); cancelSale();
        } catch (error) { console.error("Erro ao finalizar a venda: ", error); alert(`Falha na transação: ${error.message}`);
        } finally { finalizeBtn.disabled = false; finalizeBtn.textContent = 'FINALIZAR'; }
    };
    const cancelSale = () => { currentSale = []; document.getElementById('received-input').value = ''; renderSaleItems(); };
    
    // --- LÓGICA DA BUSCA DINÂMICA (AUTOCOMPLETE) ---
    const pdvSearchInput = document.getElementById('pdv-search-input');
    const pdvSearchResults = document.getElementById('pdv-search-results');
    const renderPdvSearchResults = (products) => {
        if (products.length === 0) { pdvSearchResults.classList.add('hidden'); return; }
        pdvSearchResults.innerHTML = products.map(p => `
            <div class="p-2 hover:bg-gray-100 cursor-pointer" data-product-id="${p.id}">
                <p class="font-semibold">${p.nome}</p>
                <p class="text-xs text-gray-500">Cód: ${p.code || p.id.slice(-6)} | Estoque: ${p.estoqueAtual}</p>
            </div>`).join('');
        pdvSearchResults.classList.remove('hidden');
    };
    const addProductToSaleById = (productId) => {
        const product = allProducts.find(p => p.id === productId);
        if (product) {
            if (product.estoqueAtual <= 0) { alert('Produto sem estoque!'); return; }
            const existingItem = currentSale.find(item => item.id === product.id);
            if (existingItem) {
                if (existingItem.quantity < product.estoqueAtual) existingItem.quantity++;
                else alert(`Estoque máximo atingido para ${product.nome}`);
            } else { currentSale.push({ ...product, quantity: 1 }); }
            pdvSearchInput.value = ''; pdvSearchResults.classList.add('hidden'); renderSaleItems(); pdvSearchInput.focus();
        }
    };
    const addProductByInput = () => {
        const term = pdvSearchInput.value.toLowerCase().trim();
        if (!term) return;
        let product = allProducts.find(p => p.code && p.code.toLowerCase() === term);
        if (!product) {
            const matchingProducts = allProducts.filter(p => p.nome.toLowerCase().includes(term));
            if (matchingProducts.length === 1) product = matchingProducts[0];
            else if (matchingProducts.length > 1) { renderPdvSearchResults(matchingProducts); return; }
        }
        if (product) addProductToSaleById(product.id);
        else alert('Produto não encontrado!');
    };
    
    // --- SETUP & LISTENERS ---
    onSnapshot(query(collection(db, 'produtos_estoque'), orderBy('nome')), s => { allProducts = s.docs.map(d => ({id: d.id, ...d.data()})); renderProductsTable(allProducts); });
    onSnapshot(query(collection(db, 'clientes_pdv'), orderBy('nome')), s => { allClients = s.docs.map(d => ({id: d.id, ...d.data()})); renderClientsTable(allClients); });
    onSnapshot(query(collection(db, 'movimentacoes_estoque'), orderBy('createdAt', 'desc')), s => { allMovimentacoes = s.docs.map(d => ({id: d.id, ...d.data()})); renderMovimentacoesTable(allMovimentacoes); });
    onSnapshot(query(collection(db, 'iptv_clientes'), orderBy('vencimento')), s => { allIptvClients = s.docs.map(d => ({id: d.id, ...d.data()})); renderIptvTable(allIptvClients); });

    getDocs(query(collection(db, 'users'), where('role', 'in', ['caixa', 'admin']))).then(snap => { const select = document.getElementById('seller-select'); snap.forEach(doc => select.innerHTML += `<option value="${doc.data().nome}">${doc.data().nome}</option>`); select.value = userData.nome; });
    getDoc(doc(db, 'configuracoes', 'iptv')).then(docSnap => { if (docSnap.exists()) { vencimentoMsg = docSnap.data().mensagemVencimento || ''; document.getElementById('vencimento-mensagem').value = vencimentoMsg; }});
    
    document.getElementById('product-search-input').addEventListener('input', (e) => { const searchTerm = e.target.value.toLowerCase(); const filteredProducts = allProducts.filter(p => p.nome.toLowerCase().includes(searchTerm) || (p.code && p.code.toLowerCase().includes(searchTerm))); renderProductsTable(filteredProducts); });
    document.getElementById('add-product-btn').addEventListener('click', () => openProductModal());
    document.getElementById('product-modal-form').addEventListener('submit', handleSaveProduct);
    document.getElementById('cancel-product-modal').addEventListener('click', () => hideModal(productModal));
    document.getElementById('products-table-body').addEventListener('click', e => { const editBtn = e.target.closest('.edit-product-btn'); const deleteBtn = e.target.closest('.delete-product-btn'); if (editBtn) openProductModal(editBtn.dataset.id); if (deleteBtn) (async () => { if (confirm('Tem certeza?')) await deleteDoc(doc(db, 'produtos_estoque', deleteBtn.dataset.id)); })(); });
    
    document.getElementById('client-form').addEventListener('submit', handleSaveClient);
    document.getElementById('client-form-clear').addEventListener('click', () => { document.getElementById('client-form').reset(); currentEditingClientId = null; document.getElementById('client-form-title').textContent = 'Novo Cliente'; });
    document.getElementById('clients-table-body').addEventListener('click', e => { const editBtn = e.target.closest('.edit-client-btn'); const deleteBtn = e.target.closest('.delete-client-btn'); if (editBtn) editClient(editBtn.dataset.id); if (deleteBtn) (async () => { if (confirm('Tem certeza?')) await deleteDoc(doc(db, 'clientes_pdv', deleteBtn.dataset.id)); })(); });
    
    document.getElementById('add-item-btn').addEventListener('click', addProductByInput);
    pdvSearchInput.addEventListener('keypress', e => { if (e.key === 'Enter') {e.preventDefault(); addProductByInput();} });
    pdvSearchInput.addEventListener('input', () => { const term = pdvSearchInput.value.toLowerCase(); if (term.length < 1) { pdvSearchResults.classList.add('hidden'); return; } const results = allProducts.filter(p => p.nome.toLowerCase().includes(term) || (p.code && p.code.toLowerCase().includes(term))); renderPdvSearchResults(results); });
    pdvSearchResults.addEventListener('click', e => { const target = e.target.closest('[data-product-id]'); if(target) addProductToSaleById(target.dataset.productId); });
    document.addEventListener('click', e => { if (!pdvSearchInput.contains(e.target) && !pdvSearchResults.contains(e.target)) pdvSearchResults.classList.add('hidden'); });
    
    document.getElementById('sale-items-table-body').addEventListener('click', e => {
        const target = e.target; const productId = target.closest('[data-id]')?.dataset.id; if (!productId) return;
        const item = currentSale.find(i => i.id === productId); if (!item) return;
        if (target.closest('.remove-sale-item-btn')) currentSale = currentSale.filter(i => i.id !== productId);
        else if (target.closest('.change-qty-btn')) {
            const isIncrement = target.textContent === '+';
            if (isIncrement) { if (item.quantity < item.estoqueAtual) item.quantity++; else alert(`Estoque máximo atingido para ${item.nome}`); }
            else if (item.quantity > 1) item.quantity--;
        }
        renderSaleItems();
    });
    document.getElementById('sale-items-table-body').addEventListener('change', e => {
        if (e.target.classList.contains('sale-item-qty')) {
            const productId = e.target.dataset.id; const newQty = parseInt(e.target.value);
            const item = currentSale.find(i => i.id === productId);
            if (item && newQty > 0) {
                if (newQty > item.estoqueAtual) { alert(`Estoque máximo (${item.estoqueAtual}) atingido para ${item.nome}`); e.target.value = item.estoqueAtual; }
                else item.quantity = newQty;
            }
            renderSaleItems();
        }
    });

    document.getElementById('received-input').addEventListener('input', updateSaleTotals);
    document.getElementById('cancel-sale-btn').addEventListener('click', cancelSale);
    document.getElementById('finalize-sale-btn').addEventListener('click', finalizeSale);
    
    document.getElementById('iptv-form').addEventListener('submit', handleSaveIptv);
    document.getElementById('iptv-form-clear').addEventListener('click', () => { document.getElementById('iptv-form').reset(); currentEditingIptvId = null; document.getElementById('iptv-form-title').textContent = 'Novo Cliente IPTV'; });
    document.getElementById('iptv-table-body').addEventListener('click', e => { const editBtn = e.target.closest('.edit-iptv-btn'); const deleteBtn = e.target.closest('.delete-iptv-btn'); if (editBtn) editIptv(editBtn.dataset.id); if (deleteBtn) (async () => { if (confirm('Tem certeza?')) await deleteDoc(doc(db, 'iptv_clientes', deleteBtn.dataset.id)); })(); });
    document.getElementById('save-mensagem-btn').addEventListener('click', async () => { const newMsg = document.getElementById('vencimento-mensagem').value; await setDoc(doc(db, 'configuracoes', 'iptv'), { mensagemVencimento: newMsg }); vencimentoMsg = newMsg; alert('Mensagem salva!'); });
}
