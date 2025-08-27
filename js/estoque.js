import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCTAaa5sF_O4S38FpyV_mL2hpB0xGXgAv4", authDomain: "qualificacao-a14ff.firebaseapp.com", projectId: "qualificacao-a14ff", storageBucket: "qualificacao-a14ff.appspot.com", messagingSenderId: "955642076737", appId: "1:955642076737:web:f6db77134cd6a18b8f30c0" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Localize este trecho no topo do seu arquivo js/estoque.js
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        const authCheckDiv = document.getElementById('auth-check');
        const accessDeniedDiv = document.getElementById('access-denied');
        const estoqueAppDiv = document.getElementById('estoque-app');

        if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            // MODIFIQUE A CONDIÇÃO ABAIXO
            if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'caixa')) {
                authCheckDiv.classList.add('hidden');
                estoqueAppDiv.classList.remove('hidden');
                initializeAppEstoque(user);
            } else {
                authCheckDiv.classList.add('hidden');
                accessDeniedDiv.classList.remove('hidden');
            }
        } else {
            authCheckDiv.classList.add('hidden');
            accessDeniedDiv.classList.remove('hidden');
        }
    });
});

function initializeAppEstoque(adminUser) {
    // --- Variáveis de Estado ---
    let allProducts = [], allCategories = [], allMovimentacoes = [];
    let currentEditingProductId = null;

    // --- Seletores de DOM ---
    const productModal = document.getElementById('productModal');
    const movimentacaoForm = document.getElementById('movimentacao-form');

    // --- Funções Utilitárias ---
    const showModal = (modal) => modal.classList.remove('hidden');
    const hideModal = (modal) => modal.classList.add('hidden');
    const renderTable = (tbodyId, data, rowTemplate, emptyMsg) => {
        const tbody = document.getElementById(tbodyId);
        if (tbody) {
            tbody.innerHTML = data.length > 0 ? data.map(rowTemplate).join('') : `<tr><td colspan="10" class="text-center p-4 text-gray-500">${emptyMsg}</td></tr>`;
        }
    };

    // --- Renderização ---
    const renderDashboardGeral = () => {
        const totalValue = allProducts.reduce((sum, p) => sum + ((p.estoqueAtual || 0) * (p.custoCompra || 0)), 0);
        const totalItems = allProducts.reduce((sum, p) => sum + (p.estoqueAtual || 0), 0);
        document.getElementById('kpi-valor-estoque').textContent = totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('kpi-itens-estoque').textContent = totalItems;
        document.getElementById('kpi-produtos-cadastrados').textContent = allProducts.length;
        document.getElementById('kpi-categorias').textContent = allCategories.length;
    };

    const renderProductsTable = (products) => {
    renderTable('products-table-body', products, p => `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-2 font-medium">${p.nome}</td>
            <td class="p-2">${p.categoria}</td>
            <td class="p-2 text-center font-bold ${p.estoqueAtual <= p.estoqueMinimo ? 'text-red-500' : ''}">${p.estoqueAtual || 0}</td>
            <td class="p-2 text-right">${(p.custoCompra || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td class="p-2 text-right">${(p.precoVenda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            
            <td class="p-2 text-center">
                <div class="flex justify-center items-center gap-2">
                    <button data-id="${p.id}" class="edit-product-btn text-blue-600 hover:text-blue-800 p-1" title="Editar Produto">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button data-id="${p.id}" class="delete-product-btn text-red-500 hover:text-red-700 p-1" title="Excluir Produto">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>

        </tr>
    `, 'Nenhum produto cadastrado.');
};
    
    const renderMovimentacoesTable = (movs) => {
        renderTable('movimentacoes-table-body', movs, m => {
            const tipoClasses = { entrada: 'bg-green-100 text-green-800', 'saida-venda': 'bg-blue-100 text-blue-800', 'saida-perda': 'bg-red-100 text-red-800'};
            const valorTotal = (m.quantidade * (m.custoUnitario || m.precoVenda || 0));
            return `
                <tr class="border-b">
                    <td class="p-2 text-xs">${m.data ? m.data.toDate().toLocaleString('pt-BR') : '...'}</td>
                    <td class="p-2">${m.produtoNome}</td>
                    <td class="p-2 text-center"><span class="px-2 py-1 text-xs font-semibold rounded-full ${tipoClasses[m.tipo]}">${m.tipo.replace('saida-', '')}</span></td>
                    <td class="p-2 text-center font-medium ${m.tipo.startsWith('saida') ? 'text-red-500' : 'text-green-500'}">${m.tipo.startsWith('saida') ? '-' : '+'}${m.quantidade}</td>
                    <td class="p-2 text-right">${valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>
            `;
        }, 'Nenhuma movimentação registrada.');
    };

    const renderCategoriasList = (cats) => {
        const list = document.getElementById('categorias-list');
        list.innerHTML = cats.map(c => `<div class="flex justify-between items-center bg-gray-100 p-2 rounded"><span>${c.nome}</span><button data-id="${c.id}" class="delete-categoria-btn text-red-500 hover:text-red-700"><i class="fas fa-trash-alt"></i></button></div>`).join('') || `<p class="text-xs text-gray-400 text-center p-2">Nenhuma categoria criada.</p>`;
    };
    
    // --- Lógica de Negócio ---
    const handleOpenProductModal = (productId = null) => {
        const form = document.getElementById('product-modal-form');
        form.reset();
        currentEditingProductId = productId;
        
        const categoriaSelect = document.getElementById('product-categoria');
        categoriaSelect.innerHTML = allCategories.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');

        const stockInput = document.getElementById('product-estoque-inicial');
        stockInput.disabled = !!productId;

        if (productId) {
            document.getElementById('product-modal-title').textContent = 'Editar Produto';
            const product = allProducts.find(p => p.id === productId);
            if(product){
                document.getElementById('product-nome').value = product.nome;
                categoriaSelect.value = product.categoria;
                document.getElementById('product-custo').value = product.custoCompra;
                document.getElementById('product-preco-venda').value = product.precoVenda;
                stockInput.value = product.estoqueAtual;
                document.getElementById('product-estoque-minimo').value = product.estoqueMinimo || 0;
                document.getElementById('product-descricao').value = product.descricao || '';
            }
        } else {
            document.getElementById('product-modal-title').textContent = 'Novo Produto';
        }
        showModal(productModal);
    };

    const handleSaveProduct = async (e) => {
        e.preventDefault();
        const data = {
            nome: document.getElementById('product-nome').value.trim(),
            categoria: document.getElementById('product-categoria').value,
            custoCompra: parseFloat(document.getElementById('product-custo').value),
            precoVenda: parseFloat(document.getElementById('product-preco-venda').value),
            estoqueMinimo: parseInt(document.getElementById('product-estoque-minimo').value) || 0,
            descricao: document.getElementById('product-descricao').value.trim()
        };

        if(currentEditingProductId) {
            await updateDoc(doc(db, 'produtos_estoque', currentEditingProductId), data);
            alert('Produto atualizado com sucesso!');
        } else {
            data.estoqueAtual = parseInt(document.getElementById('product-estoque-inicial').value) || 0;
            data.createdAt = serverTimestamp();
            await addDoc(collection(db, 'produtos_estoque'), data);
            alert('Produto criado com sucesso!');
        }
        hideModal(productModal);
    };

    const handleDeleteProduct = (productId) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        alert("Erro: Produto não encontrado.");
        return;
    }

    if (confirm(`Tem a certeza que deseja excluir o produto "${product.nome}"?\n\nEsta ação não pode ser desfeita.`)) {
        // Exclui o documento do Firestore
        deleteDoc(doc(db, 'produtos_estoque', productId))
            .then(() => {
                alert(`Produto "${product.nome}" excluído com sucesso!`);
            })
            .catch((error) => {
                console.error("Erro ao excluir o produto: ", error);
                alert("Ocorreu um erro ao excluir o produto. Tente novamente.");
            });
    }
};

    const handleSaveMovimentacao = async (e) => {
        e.preventDefault();
        const produtoId = document.getElementById('mov-produto').value;
        const tipo = document.getElementById('mov-tipo').value;
        const quantidade = parseInt(document.getElementById('mov-quantidade').value);
        
        if (!produtoId || !tipo || !quantidade) {
            return alert("Por favor, preencha todos os campos.");
        }

        const produtoRef = doc(db, 'produtos_estoque', produtoId);
        
        try {
            await runTransaction(db, async (transaction) => {
                const produtoDoc = await transaction.get(produtoRef);
                if (!produtoDoc.exists()) throw "Produto não encontrado!";
                
                const produtoData = produtoDoc.data();
                let novoEstoque = produtoData.estoqueAtual || 0;

                const movData = {
                    produtoId,
                    produtoNome: produtoData.nome,
                    tipo,
                    quantidade,
                    data: serverTimestamp()
                };

                if (tipo === 'entrada') {
                    novoEstoque += quantidade;
                    movData.custoUnitario = parseFloat(document.getElementById('mov-custo').value) || produtoData.custoCompra;
                } else {
                    if (novoEstoque < quantidade) throw "Estoque insuficiente!";
                    novoEstoque -= quantidade;
                    movData.precoVenda = produtoData.precoVenda;
                    movData.desconto = parseFloat(document.getElementById('mov-desconto').value) || 0;
                }
                
                transaction.update(produtoRef, { estoqueAtual: novoEstoque });
                transaction.set(doc(collection(db, 'movimentacoes')), movData);
            });

            alert('Movimentação registrada com sucesso!');
            
            if (tipo === 'entrada') {
                const custoUnitario = parseFloat(document.getElementById('mov-custo').value) || allProducts.find(p => p.id === produtoId)?.custoCompra || 0;
                const custoTotal = quantidade * custoUnitario;
                const produtoNome = allProducts.find(p => p.id === produtoId)?.nome || 'Produto Desconhecido';
                
                const despesaData = {
                    descricao: `Compra de estoque: ${quantidade}x ${produtoNome}`,
                    valor: custoTotal,
                    categoria: 'Estoque',
                    data: new Date()
                };
                await addDoc(collection(db, 'despesas'), despesaData);
                alert('A compra foi registrada como uma despesa no painel financeiro.');
            }

            movimentacaoForm.reset();

        } catch (error) {
            console.error("Erro na transação: ", error);
            alert(`Falha ao registrar movimentação: ${error}`);
        }
    };
    
    // --- Listeners e Inicialização ---
    const listenToAllData = () => { 
        onSnapshot(query(collection(db, 'produtos_estoque'), orderBy('nome')), s => { allProducts = s.docs.map(d => ({id: d.id, ...d.data()})); renderProductsTable(allProducts); renderDashboardGeral(); document.getElementById('mov-produto').innerHTML = `<option value="">Selecione...</option>` + allProducts.map(p => `<option value="${p.id}">${p.nome}</option>`).join(''); });
        onSnapshot(query(collection(db, 'categorias'), orderBy('nome')), s => { allCategories = s.docs.map(d => ({id: d.id, ...d.data()})); renderCategoriasList(allCategories); renderDashboardGeral(); });
        onSnapshot(query(collection(db, 'movimentacoes'), orderBy('data', 'desc')), s => { allMovimentacoes = s.docs.map(d => ({id:d.id, ...d.data()})); renderMovimentacoesTable(allMovimentacoes); });
    };

    const setupEventListeners = () => {
        // CORREÇÃO: Lógica de navegação por abas
        const tabs = document.querySelectorAll('.estoque-tab');
        const contents = document.querySelectorAll('.estoque-sub-section');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', e => {
                e.preventDefault();
                
                // Remove a classe ativa de todas as abas
                tabs.forEach(t => { 
                    t.classList.remove('border-blue-500', 'text-blue-600'); 
                    t.classList.add('border-transparent', 'text-gray-500'); 
                });
                
                // Adiciona a classe ativa na aba clicada
                tab.classList.add('border-blue-500', 'text-blue-600');
                tab.classList.remove('border-transparent', 'text-gray-500');
                
                // Monta o ID do conteúdo alvo
                const targetId = tab.id.replace('tab-', '') + '-content';
                
                // Esconde todos os conteúdos
                contents.forEach(c => {
                    c.classList.add('hidden');
                });
                
                // Mostra o conteúdo correspondente à aba clicada
                const targetContent = document.getElementById(targetId);
                if(targetContent) {
                    targetContent.classList.remove('hidden');
                }
            });
        });
        
        document.getElementById('add-product-btn').addEventListener('click', () => handleOpenProductModal());
        document.getElementById('products-table-body').addEventListener('click', e => {
        const editBtn = e.target.closest('.edit-product-btn');
        if (editBtn) handleOpenProductModal(editBtn.dataset.id);

        // ADICIONE ESTAS 3 LINHAS
        const deleteBtn = e.target.closest('.delete-product-btn');
        if (deleteBtn) handleDeleteProduct(deleteBtn.dataset.id);
    });
        
        document.getElementById('add-categoria-btn').addEventListener('click', async () => { const input = document.getElementById('new-categoria-input'); const nome = input.value.trim(); if(nome) { await addDoc(collection(db, 'categorias'), { nome }); input.value = ''; }});
        document.getElementById('categorias-list').addEventListener('click', async e => { if(e.target.closest('.delete-categoria-btn')) { const id = e.target.closest('.delete-categoria-btn').dataset.id; if(confirm('Tem certeza?')) await deleteDoc(doc(db, 'categorias', id)); }});
        
        document.getElementById('close-product-modal').addEventListener('click', () => hideModal(productModal));
        document.getElementById('cancel-product-modal').addEventListener('click', () => hideModal(productModal));
        document.getElementById('product-modal-form').addEventListener('submit', handleSaveProduct);
        movimentacaoForm.addEventListener('submit', handleSaveMovimentacao);

        document.getElementById('mov-tipo').addEventListener('change', e => {
            const tipo = e.target.value;
            document.getElementById('mov-custo-container').style.display = tipo === 'entrada' ? 'block' : 'none';
            document.getElementById('mov-venda-container').style.display = tipo === 'saida-venda' ? 'block' : 'none';
        });
    };

    listenToAllData();
    setupEventListeners();
}