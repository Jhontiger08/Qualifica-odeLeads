import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, onSnapshot, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCTAaa5sF_O4S38FpyV_mL2hpB0xGXgAv4", authDomain: "qualificacao-a14ff.firebaseapp.com", projectId: "qualificacao-a14ff", storageBucket: "qualificacao-a14ff.appspot.com", messagingSenderId: "955642076737", appId: "1:955642076737:web:f6db77134cd6a18b8f30c0" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis de Estado ---
    let parceiroData = null;
    let allLeadsData = [];
    let financeConfig = {};
    let chartInstance = null;
    let leadsUnsubscribe = null;

    // --- Seletores de DOM ---
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logoutBtn');
    const dateFilter = document.getElementById('date-filter');

    // --- Lógica de Autenticação ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Verifica se o UID do usuário corresponde a uma loja parceira
                const q = query(collection(db, "lojas"), where("userId", "==", user.uid));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    parceiroData = querySnapshot.docs[0].data();
                    parceiroData.id = querySnapshot.docs[0].id;
                    
                    authScreen.classList.add('hidden');
                    appScreen.classList.remove('hidden');
                    initializeAppParceiro();
                } else {
                    loginError.textContent = "Acesso negado. Esta conta não é de um parceiro.";
                    loginError.classList.remove('hidden');
                    await signOut(auth);
                }
            } catch (error) {
                console.error("Erro na verificação de parceiro:", error);
                loginError.textContent = "Ocorreu um erro ao verificar suas credenciais.";
                loginError.classList.remove('hidden');
                await signOut(auth);
            }
        } else {
            authScreen.classList.remove('hidden');
            appScreen.classList.add('hidden');
            if (leadsUnsubscribe) leadsUnsubscribe(); // Cancela o listener anterior ao deslogar
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;
        try {
            loginError.classList.add('hidden');
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            loginError.textContent = "E-mail ou senha inválidos.";
            loginError.classList.remove('hidden');
        }
    });

    logoutBtn.addEventListener('click', () => signOut(auth));

    // --- Inicializador da Aplicação do Parceiro ---
    async function initializeAppParceiro() {
        document.getElementById('loja-info').textContent = `Loja: ${parceiroData.nome}`;

        // Carrega as configurações financeiras para cálculo de comissão
        const configRef = doc(db, 'configuracoes', 'financeiras');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
            financeConfig = configSnap.data();
        }

        // Listener para as vendas vindas deste parceiro específico
        const leadsQuery = query(collection(db, "leads"), where("fonte", "==", parceiroData.nome), orderBy('dataVenda', 'desc'));
        leadsUnsubscribe = onSnapshot(leadsQuery, (snapshot) => {
            allLeadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            filterAndRender();
        });

        dateFilter.addEventListener('change', filterAndRender);
    }

    // --- Funções de Filtragem e Renderização ---
    function filterAndRender() {
        const filterValue = dateFilter.value;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        let filteredLeads = allLeadsData;

        if (filterValue === 'thisMonth') {
            filteredLeads = allLeadsData.filter(lead => {
                const leadDate = lead.dataVenda ? new Date(lead.dataVenda + 'T00:00:00') : null;
                return leadDate && leadDate >= startOfMonth;
            });
        } else if (filterValue === 'lastMonth') {
            filteredLeads = allLeadsData.filter(lead => {
                const leadDate = lead.dataVenda ? new Date(lead.dataVenda + 'T00:00:00') : null;
                return leadDate && leadDate >= startOfLastMonth && leadDate <= endOfLastMonth;
            });
        }
        
        updateDashboard(filteredLeads);
    }
    
    // --- Atualização do Dashboard (KPIs, Gráfico, Tabela) ---
    function updateDashboard(leads) {
        const comissaoPercentual = (parseFloat(financeConfig.comissao) || 0) / 100;
        
        const vendasAtivas = leads.filter(l => l.subStatusAgendamento === 'Ativa');
        
        const totalVendas = vendasAtivas.length;
        const valorTotal = vendasAtivas.reduce((sum, lead) => sum + (parseFloat(lead.valorPlano) || 0), 0);
        const comissaoTotal = valorTotal * comissaoPercentual;

        document.getElementById('kpi-total-vendas').textContent = totalVendas;
        document.getElementById('kpi-valor-vendido').textContent = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('kpi-comissao').textContent = comissaoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        renderVendasTable(leads, comissaoPercentual);

        const salesByDay = leads.reduce((acc, lead) => {
            if (lead.dataVenda) {
                const day = lead.dataVenda;
                acc[day] = (acc[day] || 0) + 1;
            }
            return acc;
        }, {});

        const sortedDays = Object.keys(salesByDay).sort((a, b) => new Date(a) - new Date(b));
        const chartLabels = sortedDays.map(day => new Date(day + 'T00:00:00').toLocaleDateString('pt-BR'));
        const chartData = sortedDays.map(day => salesByDay[day]);

        renderChart('performanceChart', 'bar', chartLabels, chartData, 'Vendas por Dia');
    }

    function renderVendasTable(leads, comissaoPercentual) {
        const tableBody = document.getElementById('vendas-table-body');
        if (leads.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-gray-500">Nenhuma venda encontrada para este período.</td></tr>`;
            return;
        }

        tableBody.innerHTML = leads.map(lead => {
            const isAtiva = lead.subStatusAgendamento === 'Ativa';
            const comissao = isAtiva ? (parseFloat(lead.valorPlano) || 0) * comissaoPercentual : 0;
            const statusStyles = { 'Ativa': 'bg-green-100 text-green-800', 'Cancelada': 'bg-red-100 text-red-800', 'Pendente': 'bg-yellow-100 text-yellow-800', 'Agendada': 'bg-blue-100 text-blue-800' };

            return `
                <tr class="border-b">
                    <td class="p-3">${lead.dataVenda ? new Date(lead.dataVenda + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</td>
                    <td class="p-3">${lead.nome_completo || 'Não informado'}</td>
                    <td class="p-3">${lead.plano || 'N/A'}</td>
                    <td class="p-3">${(parseFloat(lead.valorPlano) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td class="p-3"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[lead.subStatusAgendamento] || 'bg-gray-100'}">${lead.subStatusAgendamento || 'N/A'}</span></td>
                    <td class="p-3 font-medium ${isAtiva ? 'text-green-600' : 'text-gray-400'}">${comissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>
            `;
        }).join('');
    }

    function renderChart(id, type, labels, data, label) {
        if (chartInstance) {
            chartInstance.destroy();
        }
        const ctx = document.getElementById(id)?.getContext('2d');
        if (ctx) {
            chartInstance = new Chart(ctx, {
                type: type,
                data: {
                    labels: labels,
                    datasets: [{
                        label: label,
                        data: data,
                        backgroundColor: 'rgba(59, 130, 246, 0.5)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1
                    }]
                },
                options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        }
    }
});