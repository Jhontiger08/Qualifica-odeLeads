import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, onSnapshot, query, updateDoc, orderBy, serverTimestamp, addDoc, getDocs, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCTAaa5sF_O4S38FpyV_mL2hpB0xGXgAv4", authDomain: "qualificacao-a14ff.firebaseapp.com", projectId: "qualificacao-a14ff", storageBucket: "qualificacao-a14ff.appspot.com", messagingSenderId: "955642076737", appId: "1:955642076737:web:f6db77134cd6a18b8f30c0" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Variáveis Globais de Estado ---
let allLeadsData = [], allUsersData = [], allQualificacoesData = [], financeConfig = {};
let currentEditingLeadId = null, currentUserForReport = null, chartInstances = {};
let chatUnsubscribe = null, isChatOpen = false, isInitialMessagesLoad = true, chatListenersAttached = false;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        const authCheckDiv = document.getElementById('auth-check'), accessDeniedDiv = document.getElementById('access-denied'), managerAppDiv = document.getElementById('manager-app');
        const chatWidgetContainer = document.getElementById('chat-widget-container');
        
        if(user){
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if(userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'gestor')){
                authCheckDiv.classList.add('hidden');
                managerAppDiv.classList.remove('hidden');
                chatWidgetContainer.classList.remove('hidden');
                const userData = userDoc.data();
                document.getElementById('user-info').textContent = `Logado como: ${userData.nome} (${userData.role})`;

                // Lógica de restrição para BKO (Backoffice)
                const isBKO = userData.role === 'gestor' && userData.isVendedor === false;
                if(isBKO) {
                    document.getElementById('tab-dashboard').classList.add('hidden');
                    document.getElementById('tab-time').classList.add('hidden');
                    // Ativa a aba de Vendas como padrão para BKO
                    document.getElementById('tab-dashboard').classList.remove('border-blue-500', 'text-blue-600');
                    document.getElementById('dashboard-section').classList.add('hidden');
                    document.getElementById('tab-vendas').classList.add('border-blue-500', 'text-blue-600');
                    document.getElementById('vendas-section').classList.remove('hidden');
                } else {
                    // Garante que a aba de Dashboard seja a padrão para gestores/admins normais
                    document.getElementById('tab-dashboard').classList.add('border-blue-500', 'text-blue-600');
                }

                initializeAppManager(user, userData);
                initializeGlobalChat(userData);
            } else {
                authCheckDiv.classList.add('hidden');
                accessDeniedDiv.classList.remove('hidden');
                chatWidgetContainer.classList.add('hidden');
            }
        } else {
            authCheckDiv.classList.add('hidden');
            accessDeniedDiv.classList.remove('hidden');
            chatWidgetContainer.classList.add('hidden');
        }
    });
});

function initializeAppManager(user, userData) {
    // --- Seletores de Elementos DOM ---
    const searchInput = document.getElementById('search-input'), vendedorFilter = document.getElementById('filter-vendedor'), statusFilter = document.getElementById('filter-status'), monthFilter = document.getElementById('filter-month'), startDateFilter = document.getElementById('filter-start-date'), endDateFilter = document.getElementById('filter-end-date'), savePeriodBtn = document.getElementById('save-period-btn'), clearPeriodBtn = document.getElementById('clear-period-btn'), saleDetailModal = document.getElementById('saleDetailModal'), caseNotification = document.getElementById('case-notification');

    // --- Funções de Renderização ---
    const renderChart = (id, type, labels, data, label) => { if(chartInstances[id]) chartInstances[id].destroy(); const ctx = document.getElementById(id)?.getContext('2d'); if(ctx) { chartInstances[id] = new Chart(ctx, { type, data: { labels, datasets: [{ label, data, backgroundColor: ['#3B82F6', '#EF4444', '#FFC107', '#87CEEB', '#28A745', '#BDB76B', '#4682B4', '#8A2BE2', '#006400', '#FF4500', '#696969'] }] } }); }};
    const renderSalesTable=(d)=>{const t=document.getElementById('manager-sales-table');t.innerHTML=d.length===0?`<tr><td colspan="7" class="text-center p-4 text-gray-500">Nenhuma venda encontrada para os filtros aplicados.</td></tr>`:d.map(l=>{const s={'Ativa':'bg-green-100 text-green-800','Cancelada':'bg-red-100 text-red-800','Pendente':'bg-yellow-100 text-yellow-800','Suspensa':'bg-gray-100 text-gray-800','Agendada':'bg-blue-100 text-blue-800'};return`<tr class="border-b hover:bg-gray-50"><td class="p-3 font-medium">${l.nome_completo||'N/A'}</td><td class="p-3">${l.vendedor||'N/A'}</td><td class="p-3">${l.plano||'N/A'}</td><td class="p-3">R$ ${parseFloat(l.valorPlano || 0).toFixed(2)}</td><td class="p-3"><span class="px-2 py-1 text-xs font-semibold rounded-full ${s[l.subStatusAgendamento]||'bg-gray-100'}">${l.subStatusAgendamento||'N/A'}</span></td><td class="p-3">${l.dataVenda?new Date(l.dataVenda+'T00:00:00').toLocaleDateString('pt-BR'):'N/A'}</td><td class="p-3 text-center"><button data-lead-id="${l.id}" data-type="venda" class="view-detail-btn text-sm bg-blue-600 text-white py-1 px-3 rounded-lg hover:bg-blue-700">Ver/Editar</button></td></tr>`}).join('')};
    const renderCasesTable=(d)=>{const t=document.getElementById('manager-cases-table');t.innerHTML=d.length===0?`<tr><td colspan="5" class="text-center p-4 text-gray-500">Nenhum caso encontrado.</td></tr>`:d.map(l=>{const r=l.gestor_observacao?'bg-green-50 hover:bg-green-100':'hover:bg-gray-50';return`<tr class="border-b ${r}"><td class="p-3 font-medium">${l.nome_completo||l.contato||'N/A'}</td><td class="p-3">${l.vendedor||'N/A'}</td><td class="p-3">${l.prazo?new Date(l.prazo+'T00:00:00').toLocaleDateString('pt-BR'):'Não definido'}</td><td class="p-3 text-gray-600">${(l.descricao_caso || '').substring(0,70)}...</td><td class="p-3 text-center"><button data-lead-id="${l.id}" data-type="caso" class="view-detail-btn text-sm bg-purple-600 text-white py-1 px-3 rounded-lg hover:bg-purple-700">Ver Detalhes</button></td></tr>`}).join('')};
    const renderTeamManagement = (managerUid) => {
        const container = document.getElementById('team-members-container');
        if(!container) return;
        const myTeam = allUsersData.filter(u => u.role === 'user' && u.supervisores && u.supervisores.includes(managerUid));
        if(myTeam.length === 0) { container.innerHTML = `<div class="col-span-full text-center p-10 bg-gray-50 rounded-lg"><i class="fas fa-user-friends text-4xl text-gray-400 mb-4"></i><p class="text-gray-600">Nenhum vendedor foi atribuído ao seu time.</p><p class="text-sm text-gray-500 mt-2">Use o Painel de Administrador para gerenciar os times.</p></div>`; return; }
        const salesKpiNames = allQualificacoesData.filter(q => q.kpiLink === 'vendasRealizadas').map(q => q.nome);
        const scheduledKpiNames = allQualificacoesData.filter(q => q.kpiLink === 'vendasAgendadas').map(q => q.nome);
        container.innerHTML = myTeam.map(vendedor => {
            const sellerLeads = allLeadsData.filter(lead => lead.userId === vendedor.id);
            const totalLeads = sellerLeads.length;
            const vendas = sellerLeads.filter(l => salesKpiNames.includes(l.qualificacao) || (scheduledKpiNames.includes(l.qualificacao) && l.subStatusAgendamento === 'Ativo'));
            const totalVendas = vendas.length;
            const valorTotalVendido = vendas.reduce((sum, v) => sum + (parseFloat(v.valorPlano) || 0), 0);
            const taxaConversao = totalLeads > 0 ? ((totalVendas / totalLeads) * 100).toFixed(1) : 0;
            return `<div class="bg-white p-5 rounded-lg shadow border flex flex-col"><h4 class="font-bold text-lg text-gray-800">${vendedor.nome}</h4><div class="mt-4 pt-4 border-t grid grid-cols-2 gap-4 flex-grow"><div><p class="text-xs text-gray-500">Total Leads</p><p class="font-bold text-lg">${totalLeads}</p></div><div><p class="text-xs text-gray-500">Vendas</p><p class="font-bold text-lg">${totalVendas}</p></div><div><p class="text-xs text-gray-500">Valor Vendido</p><p class="font-bold text-lg">R$ ${valorTotalVendido.toFixed(2)}</p></div><div><p class="text-xs text-gray-500">Conversão</p><p class="font-bold text-lg">${taxaConversao}%</p></div></div><div class="mt-4 pt-4 border-t"><button data-uid="${vendedor.id}" class="view-seller-report-btn w-full bg-blue-100 text-blue-700 font-semibold py-2 px-4 rounded-lg hover:bg-blue-200 text-sm">Ver Relatório Detalhado</button></div></div>`;
        }).join('');
    };

    // --- Lógica de Dados e Filtros ---
    const applyFiltersAndRender = () => {
        let filteredLeads = allLeadsData;
        const salesQualificacoes = allQualificacoesData.filter(q => q.showInSales === 'true' || q.kpiLink === 'vendasRealizadas' || q.kpiLink === 'vendasAgendadas').map(q => q.nome);
        let sales = allLeadsData.filter(l => salesQualificacoes.includes(l.qualificacao));
        let cases = allLeadsData.filter(l => l.descricao_caso && l.descricao_caso.trim() !== '');
        
        const searchTerm=searchInput.value.toLowerCase().trim(),vendedor=vendedorFilter.value,status=statusFilter.value,month=monthFilter.value,startDate=startDateFilter.value,endDate=endDateFilter.value;
        
        if (searchTerm) { const searchFilter = l => [l.nome_completo, l.cpfCnpj, l.contato].some(f => f && f.toLowerCase().includes(searchTerm)); sales = sales.filter(searchFilter); cases = cases.filter(searchFilter); filteredLeads = filteredLeads.filter(searchFilter); }
        if (vendedor !== 'all') { sales = sales.filter(l => l.vendedor === vendedor); cases = cases.filter(l => l.vendedor === vendedor); filteredLeads = filteredLeads.filter(l => l.vendedor === vendedor); }
        if (startDate && endDate) { const dateFilter = l => l.dataVenda && l.dataVenda >= startDate && l.dataVenda <= endDate; sales = sales.filter(dateFilter); filteredLeads = allLeadsData.filter(l => l.createdAt && l.createdAt.toDate() >= new Date(startDate) && l.createdAt.toDate() <= new Date(endDate + 'T23:59:59')); monthFilter.value = ''; } else if (month) { const monthFilterFunc = l => l.dataVenda && l.dataVenda.startsWith(month); sales = sales.filter(monthFilterFunc); filteredLeads = allLeadsData.filter(l => l.createdAt && l.createdAt.toDate().toISOString().startsWith(month)); }
        if (status !== 'all') { const statusFilterFunc = l => l.subStatusAgendamento === status; sales = sales.filter(statusFilterFunc); filteredLeads = filteredLeads.filter(statusFilterFunc); }
        
        renderSalesTable(sales);
        renderCasesTable(cases);
        updateGestorDashboard(filteredLeads);
        renderTeamManagement(user.uid);
    };

    const updateGestorDashboard = (leads) => {
        const activeSellers = allUsersData.filter(u => u.role === 'user' || (u.isVendedor === true && (u.role === 'gestor' || u.role === 'admin')));
        const activeSellerNames = activeSellers.map(u => u.nome);
        const leadsFromActiveSellers = allLeadsData.filter(l => activeSellerNames.includes(l.vendedor));
        const salesKpiNames = allQualificacoesData.filter(q => q.kpiLink === 'vendasRealizadas').map(q => q.nome);
        const scheduledKpiNames = allQualificacoesData.filter(q => q.kpiLink === 'vendasAgendadas').map(q => q.nome);
        const kpiVendasTotal = leadsFromActiveSellers.filter(l => salesKpiNames.includes(l.qualificacao) || (scheduledKpiNames.includes(l.qualificacao) && l.subStatusAgendamento === 'Ativo')).length;
        const kpiAgendadasTotal = leadsFromActiveSellers.filter(l => scheduledKpiNames.includes(l.qualificacao) && l.subStatusAgendamento !== 'Ativo').length;
        document.getElementById('kpi-total').textContent = leads.length; document.getElementById('kpi-vendas').textContent = kpiVendasTotal; document.getElementById('kpi-agendadas').textContent = kpiAgendadasTotal; document.getElementById('kpi-vendedores').textContent = activeSellers.length;
        const leadsForCharts = leads.filter(l => activeSellerNames.includes(l.vendedor));
        const statusCounts = leadsForCharts.reduce((acc, l) => { if(l.qualificacao) acc[l.qualificacao] = (acc[l.qualificacao] || 0) + 1; return acc; }, {});
        const vendedorCounts = leadsForCharts.reduce((acc, l) => { if(l.vendedor) acc[l.vendedor] = (acc[l.vendedor] || 0) + 1; return acc; }, {});
        renderChart('statusChart', 'doughnut', Object.keys(statusCounts), Object.values(statusCounts));
        renderChart('vendedorChart', 'bar', Object.keys(vendedorCounts), Object.values(vendedorCounts), 'Leads por Vendedor');
    };

    // --- Funções de Modal ---
    const openDetailModal=(leadId,type)=>{currentEditingLeadId=leadId;const l=allLeadsData.find(l=>l.id===leadId);if(!l)return;document.getElementById('modal-title').textContent=type==='venda'?'Detalhes da Venda':'Detalhes do Caso';document.getElementById('venda-details-fieldset').style.display=type==='venda'?'block':'none';document.getElementById('caso-details-fieldset').style.display=type==='caso'?'block':'none';document.getElementById('status-management-section').style.display=type==='venda'?'block':'none';const N_A='Não informado',f=d=>d?new Date(d+'T00:00:00').toLocaleDateString('pt-BR'):N_A,s=(i,v)=>document.getElementById(i).textContent=v||N_A;s('detail-nome',l.nome_completo);s('detail-cpf',l.cpfCnpj);s('detail-rg',l.rg);s('detail-nascimento',f(l.dataNascimento));s('detail-telefone',l.contato);s('detail-email',l.email);s('detail-endereco',`${l.rua||''}, ${l.numero||''}`);s('detail-bairro',l.bairro);s('detail-cidade',l.cidade);s('detail-cep',l.cep);s('detail-plano',l.plano);s('detail-valor',`R$ ${parseFloat(l.valorPlano || 0).toFixed(2)}`);s('detail-operadora',l.operadora);s('detail-fonte',l.fonteVenda||l.fonte);s('detail-vendedor',l.vendedor);s('detail-data-venda',f(l.dataVenda));s('detail-contrato',l.contrato);s('detail-protocolo',l.protocolo);s('detail-obs-vendedor',l.observacaoVenda);s('detail-prazo',f(l.prazo));s('detail-urgencia',l.urgencia);s('detail-descricao-caso',l.descricao_caso);document.getElementById('detail-obs-gestor').value=l.gestor_observacao||'';s('detail-data-status',l.lastStatusUpdate?l.lastStatusUpdate.toDate().toLocaleString('pt-BR'):'Nunca');const sel=document.getElementById('detail-status'),st=['Pendente','Ativa','Cancelada','Suspensa','Agendada'];sel.innerHTML=st.map(s=>`<option value="${s}" ${l.subStatusAgendamento===s?'selected':''}>${s}</option>`).join('');saleDetailModal.classList.remove('hidden')};
    const saveSaleDetails=async()=>{if(!currentEditingLeadId)return;const d={subStatusAgendamento:document.getElementById('detail-status').value,gestor_observacao:document.getElementById('detail-obs-gestor').value,lastStatusUpdate:serverTimestamp()};await updateDoc(doc(db,'leads',currentEditingLeadId),d);saleDetailModal.classList.add('hidden');currentEditingLeadId=null;alert('Alterações salvas!')};
    const openSellerReportModal = (userId) => { currentUserForReport = allUsersData.find(u => u.id === userId); if (!currentUserForReport) return; document.getElementById('sellerReportModalTitle').textContent = `Relatório de: ${currentUserForReport.nome}`; const salesKpiNames = allQualificacoesData.filter(q => q.kpiLink === 'vendasRealizadas').map(q => q.nome); const scheduledKpiNames = allQualificacoesData.filter(q => q.kpiLink === 'vendasAgendadas').map(q => q.nome); const sellerLeads = allLeadsData.filter(l => l.userId === userId); const vendas = sellerLeads.filter(l => salesKpiNames.includes(l.qualificacao) || (scheduledKpiNames.includes(l.qualificacao) && l.subStatusAgendamento === 'Ativo')); const estornos = sellerLeads.filter(l => l.subStatusAgendamento === 'Cancelado'); let totalVendasValor = 0, totalEstornosValor = 0; document.getElementById('seller-sales-table-body').innerHTML = vendas.map(v => { const valor = parseFloat(v.valorPlano) || 0; totalVendasValor += valor; return `<tr class="border-b"><td class="p-2">${v.dataVenda || 'N/A'}</td><td class="p-2">${v.nome_completo || v.contato}</td><td class="p-2">${v.cpfCnpj || 'N/A'}</td><td class="p-2">${v.plano || 'N/A'}</td><td class="p-2">R$ ${valor.toFixed(2)}</td><td class="p-2">${v.operadora || 'N/A'}</td></tr>`; }).join(''); document.getElementById('seller-estornos-table-body').innerHTML = estornos.map(e => { const valor = parseFloat(e.valorPlano) || 0; totalEstornosValor += valor; return `<tr class="border-b"><td class="p-2">${e.dataVenda || 'N/A'}</td><td class="p-2">${e.nome_completo || e.contato}</td><td class="p-2">${e.cpfCnpj || 'N/A'}</td><td class="p-2">${e.plano || 'N/A'}</td><td class="p-2">R$ ${valor.toFixed(2)}</td><td class="p-2">${e.subStatusAgendamento}</td></tr>`; }).join(''); const comissaoPadrao = parseFloat(financeConfig.comissao) || 0; const metaMensal = parseFloat(financeConfig.meta) || 0; const comissaoBonus = parseFloat(financeConfig.bonus) || 0; const considerarEstornos = financeConfig.considerarEstornos === 'true'; let taxaComissao = comissaoPadrao; if (metaMensal > 0 && totalVendasValor >= metaMensal && comissaoBonus > 0) { taxaComissao = comissaoBonus; } const valorBaseComissao = totalVendasValor - (considerarEstornos ? totalEstornosValor : 0); const comissaoCalculada = valorBaseComissao * (taxaComissao / 100); document.getElementById('report-kpi-vendas').textContent = vendas.length; document.getElementById('report-kpi-valor').textContent = `R$ ${totalVendasValor.toFixed(2)}`; document.getElementById('report-kpi-estornos').textContent = `R$ ${totalEstornosValor.toFixed(2)}`; document.getElementById('report-kpi-comissao').textContent = `R$ ${comissaoCalculada.toFixed(2)}`; document.getElementById('sellerReportModal').classList.remove('hidden'); };
    const exportSellerReportPDF = () => { if (!currentUserForReport) return; const { jsPDF } = window.jspdf; const doc = new jsPDF(); const userName = currentUserForReport.nome || 'N/A'; let cursorY = 20; doc.setFontSize(18).text(`Relatório de Vendas: ${userName}`, 105, cursorY, { align: 'center' }); cursorY += 10; doc.setFontSize(10).text(new Date().toLocaleDateString('pt-BR'), 105, cursorY, { align: 'center' }); cursorY += 15; const kpiVendas = document.getElementById('report-kpi-vendas').textContent; const kpiValor = document.getElementById('report-kpi-valor').textContent; const kpiEstornos = document.getElementById('report-kpi-estornos').textContent; const kpiComissao = document.getElementById('report-kpi-comissao').textContent; doc.setFontSize(12).text('Resumo do Período', 14, cursorY); cursorY += 7; doc.setFontSize(10).text(`- Vendas Realizadas: ${kpiVendas}`, 14, cursorY); cursorY += 5; doc.setFontSize(10).text(`- Valor Total (Vendas): ${kpiValor}`, 14, cursorY); cursorY += 5; doc.setFontSize(10).text(`- Total Estornos: ${kpiEstornos}`, 14, cursorY); cursorY += 5; doc.setFontSize(10).text(`- Comissão Estimada: ${kpiComissao}`, 14, cursorY); cursorY += 15; if (document.getElementById('seller-sales-table-body').rows.length > 0) { doc.setFontSize(12).text('Detalhes das Vendas', 14, cursorY); doc.autoTable({ startY: cursorY + 5, html: '#seller-sales-table-body', head: [['Data', 'Cliente', 'CPF', 'Plano', 'Valor', 'Operadora']], theme: 'grid' }); cursorY = doc.autoTable.previous.finalY + 15; } if (document.getElementById('seller-estornos-table-body').rows.length > 0) { if(cursorY > 250) { doc.addPage(); cursorY = 20; } doc.setFontSize(12).text('Detalhes dos Estornos', 14, cursorY); doc.autoTable({ startY: cursorY + 5, html: '#seller-estornos-table-body', head: [['Data', 'Cliente', 'CPF', 'Plano', 'Valor', 'Status']], theme: 'grid' }); } doc.save(`Relatorio_${userName}_${new Date().toISOString().split('T')[0]}.pdf`); };
    
    // --- Funções de Período e Notificação ---
    const savePeriod=()=>{const s=startDateFilter.value,e=endDateFilter.value;if(s&&e){localStorage.setItem('gestor_startDate',s);localStorage.setItem('gestor_endDate',e);monthFilter.value='';alert('Período salvo!');applyFiltersAndRender()}};
    const clearPeriod=()=>{localStorage.removeItem('gestor_startDate');localStorage.removeItem('gestor_endDate');startDateFilter.value='';endDateFilter.value='';monthFilter.value='';alert('Período limpo!');applyFiltersAndRender()};
    const loadSavedPeriod=()=>{const s=localStorage.getItem('gestor_startDate'),e=localStorage.getItem('gestor_endDate');if(s&&e){startDateFilter.value=s;endDateFilter.value=e}};
    const checkForNewCases = () => { const allCaseIds = allLeadsData.filter(l => l.descricao_caso).map(l => l.id); const seenCaseIds = JSON.parse(localStorage.getItem('seenCaseIds_gestor') || '[]'); const newCasesCount = allCaseIds.filter(id => !seenCaseIds.includes(id)).length; if (newCasesCount > 0) { caseNotification.textContent = newCasesCount; caseNotification.classList.remove('hidden'); } else { caseNotification.classList.add('hidden'); } };
    const markCasesAsSeen = () => { const allCaseIds = allLeadsData.filter(l => l.descricao_caso).map(l => l.id); localStorage.setItem('seenCaseIds_gestor', JSON.stringify(allCaseIds)); caseNotification.classList.add('hidden'); };

    // --- Carregamento Inicial de Dados ---
    const loadInitialData = () => {
        loadSavedPeriod();
        onSnapshot(query(collection(db,'users')),s=>{allUsersData=s.docs.map(d=>({id: d.id, ...d.data()}));vendedorFilter.innerHTML='<option value="all">Todos</option>';allUsersData.filter(u=>u.nome).sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).forEach(u=>vendedorFilter.innerHTML+=`<option value="${u.nome}">${u.nome}</option>`)});
        onSnapshot(query(collection(db,'qualificacoes')),s=>{allQualificacoesData=s.docs.map(d=>({...d.data(),id:d.id}));applyFiltersAndRender()});
        onSnapshot(query(collection(db,'leads'),orderBy('createdAt','desc')),s=>{allLeadsData=s.docs.map(d=>({...d.data(),id:d.id}));applyFiltersAndRender();checkForNewCases()});
        const configRef = doc(db, 'configuracoes', 'financeiras'); onSnapshot(configRef, (docSnap) => { if (docSnap.exists()) { financeConfig = docSnap.data(); }});
    };
    
    // --- Setup de Eventos ---
    const setupEventListeners = () => {
        document.querySelectorAll('.nav-tab').forEach(tab=>{tab.addEventListener('click',e=>{e.preventDefault();document.querySelectorAll('.page-section').forEach(s=>s.classList.add('hidden'));document.querySelectorAll('.nav-tab').forEach(t=>{t.classList.remove('border-blue-500','text-blue-600');t.classList.add('border-transparent','text-gray-500','hover:text-gray-700')});const targetId=tab.id.replace('tab-','');document.getElementById(targetId+'-section').classList.remove('hidden');if(targetId==='casos'){markCasesAsSeen()}tab.classList.add('border-blue-500','text-blue-600');tab.classList.remove('border-transparent','text-gray-500')})});
        [searchInput,vendedorFilter,statusFilter,monthFilter,startDateFilter,endDateFilter].forEach(el=>el.addEventListener('input',applyFiltersAndRender));
        savePeriodBtn.addEventListener('click', savePeriod);
        clearPeriodBtn.addEventListener('click', clearPeriod);
        document.getElementById('manager-sales-table').addEventListener('click',e=>{const b=e.target.closest('.view-detail-btn');if(b)openDetailModal(b.dataset.leadId,b.dataset.type)});
        document.getElementById('manager-cases-table').addEventListener('click',e=>{const b=e.target.closest('.view-detail-btn');if(b)openDetailModal(b.dataset.leadId,b.dataset.type)});
        document.getElementById('closeSaleDetailModal').addEventListener('click',()=>saleDetailModal.classList.add('hidden'));
        document.getElementById('cancelSaleDetail').addEventListener('click',()=>saleDetailModal.classList.add('hidden'));
        document.getElementById('saveSaleDetail').addEventListener('click',saveSaleDetails);
        document.getElementById('team-members-container').addEventListener('click', e => { const btn = e.target.closest('.view-seller-report-btn'); if(btn) openSellerReportModal(btn.dataset.uid); });
        document.getElementById('closeSellerReportModal').addEventListener('click', () => document.getElementById('sellerReportModal').classList.add('hidden'));
        document.getElementById('exportSellerReportPdf').addEventListener('click', exportSellerReportPDF);
    };

    // --- Inicialização ---
    loadInitialData();
    setupEventListeners();
}

// --- Lógica do Chat Global ---
function initializeGlobalChat(userData) {
    if (!userData) return;
    const chatToggleButton = document.getElementById('chat-toggle-btn'), chatWindow = document.getElementById('chat-window'), chatCloseButton = document.getElementById('chat-close-btn'), chatForm = document.getElementById('chat-form'), chatMessageInput = document.getElementById('chat-message-input'), chatNotificationBadge = document.getElementById('chat-notification-badge'), chatNotificationSound = document.getElementById('chat-notification-sound');
    
    const toggleChatWindow = () => { isChatOpen = !isChatOpen; if (isChatOpen) { chatWindow.classList.remove('hidden'); setTimeout(() => { chatWindow.classList.remove('opacity-0', 'translate-y-4'); chatNotificationBadge.classList.add('hidden'); document.getElementById('chat-messages-container').scrollTop = document.getElementById('chat-messages-container').scrollHeight; }, 10); } else { chatWindow.classList.add('opacity-0', 'translate-y-4'); setTimeout(() => { chatWindow.classList.add('hidden'); }, 300); } };
    
    if (!chatListenersAttached) {
        chatToggleButton.addEventListener('click', toggleChatWindow);
        chatCloseButton.addEventListener('click', toggleChatWindow);
        chatListenersAttached = true;
    }
    
    chatForm.onsubmit = async (e) => { e.preventDefault(); const messageText = chatMessageInput.value.trim(); if (messageText && auth.currentUser) { chatMessageInput.value = ''; await addDoc(collection(db, 'chat_messages'), { text: messageText, userId: auth.currentUser.uid, userName: userData.nome, userRole: userData.role, timestamp: serverTimestamp() }); } };
    
    if (chatUnsubscribe) chatUnsubscribe();
    const q = query(collection(db, 'chat_messages'), orderBy('timestamp', 'asc'));
    chatUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => { if (change.type === "added" && !isInitialMessagesLoad) { if (change.doc.data().userId !== auth.currentUser.uid && !isChatOpen) { chatNotificationBadge.classList.remove('hidden'); chatNotificationSound.play().catch(e => {}); } } });
        const chatMessagesContainer = document.getElementById('chat-messages-container');
        chatMessagesContainer.innerHTML = '';
        snapshot.forEach(doc => { renderChatMessage(doc.data(), auth.currentUser.uid); });
        isInitialMessagesLoad = false;
        if(isChatOpen) { chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight; }
    });
}

function renderChatMessage(data, currentUserId) {
    const messagesContainer = document.getElementById('chat-messages-container');
    if (!messagesContainer) return;
    const isSentByMe = data.userId === currentUserId;
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `flex mb-3 ${isSentByMe ? 'justify-end' : 'justify-start'}`;
    const roleBadges = { admin: 'bg-red-500 text-white', gestor: 'bg-purple-500 text-white', user: 'bg-blue-500 text-white' };
    const roleNames = { admin: 'Admin', gestor: 'Gestor', user: 'Vendedor' };
    messageWrapper.innerHTML = `
        <div class="max-w-xs">
            <div class="flex items-center gap-2 ${isSentByMe ? 'flex-row-reverse' : ''}">
                <span class="font-bold text-sm">${isSentByMe ? 'Você' : data.userName}</span>
                <span class="text-xs px-2 py-0.5 rounded-full ${roleBadges[data.userRole] || 'bg-gray-500 text-white'}">${roleNames[data.userRole] || 'Usuário'}</span>
            </div>
            <div class="text-sm p-3 mt-1 rounded-lg ${isSentByMe ? 'bg-blue-100' : 'bg-gray-100'}">
                <p style="word-wrap: break-word;">${data.text}</p>
            </div>
            <p class="text-xs text-gray-400 mt-1 ${isSentByMe ? 'text-right' : 'text-left'}">
                ${data.timestamp ? data.timestamp.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : ''}
            </p>
        </div>
    `;
    messagesContainer.appendChild(messageWrapper);
}