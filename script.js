/**
 * @file Script principal para a página da Piel Telecom.
 * @summary Gerencia a interatividade do menu, modais, formulários, e a exibição dinâmica de planos.
 * @version 6.0.0 - Edição com Modal Unificado e Cidades do Brasil
 * @description Esta versão unifica o fluxo de contratação. O modal de cidade agora aparece
 * para todos os planos, mas exibe uma lista limitada para Fibra e uma lista nacional para Satélite,
 * com textos explicativos diferentes.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const App = {
        config: {
            firebaseConfig: { 
                apiKey: "AIzaSyCTAaa5sF_O4S38FpyV_mL2hpB0xGXgAv4", 
                authDomain: "qualificacao-a14ff.firebaseapp.com", 
                projectId: "qualificacao-a14ff", 
                storageBucket: "qualificacao-a14ff.appspot.com", 
                messagingSenderId: "955642076737", 
                appId: "1:955642076737:web:f6db77134cd6a18b8f30c0" 
            },
            whatsappNumber: '5513992006688',
            viacepUrl: 'https://viacep.com.br/ws/',
        },

        state: {
            selectedPlanInfo: {},
            citiesFibra: [],
            citiesBrazil: [], // Lista para todas as cidades do Brasil
            allPlans: [], 
            flickityInstances: {},
        },

        nodes: {},
        db: null,

        /**
         * Ponto de entrada da aplicação.
         */
        async init() {
            this._mapDOMNodes();
            this._initializeFirebase();
            await this._fetchPlansFromFirestore();
            await this._setupState(); // Tornou-se assíncrono para buscar as cidades
            this._renderDynamicPlans();
            this._bindEvents();
            this._initPlugins();
            console.log("Aplicação Piel Telecom v6.0.0 (Final) inicializada com sucesso. 🚀");
        },

        /**
         * Inicializa a conexão com o Firebase/Firestore.
         */
        _initializeFirebase() {
            try {
                const app = initializeApp(this.config.firebaseConfig);
                this.db = getFirestore(app);
            } catch (error) {
                console.error("Falha ao inicializar o Firebase:", error);
            }
        },
        
        /**
         * Busca os planos da coleção 'produtos' no Firestore.
         */
        async _fetchPlansFromFirestore() {
            if (!this.db) {
                console.error("Conexão com o Firestore não estabelecida.");
                return;
            }
            try {
                const q = query(collection(this.db, "produtos"), orderBy("valorPromocional", "asc"));
                const querySnapshot = await getDocs(q);
                this.state.allPlans = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error("Erro ao buscar planos do Firestore:", error);
                const errorHtml = '<p class="text-center text-red-500 col-span-full">Não foi possível carregar os planos. Verifique sua conexão ou tente recarregar a página.</p>';
                if (this.nodes.promoCarouselFibra) this.nodes.promoCarouselFibra.innerHTML = errorHtml;
                if (this.nodes.plansContainerFibra) this.nodes.plansContainerFibra.innerHTML = errorHtml;
            }
        },

        /**
         * Mapeia os elementos do DOM para acesso rápido.
         */
        _mapDOMNodes() {
            const nodeSelectors = {
                menuBtn: '#menu-btn', mobileMenu: '#mobile-menu', menuIconOpen: '#menu-icon-open', menuIconClose: '#menu-icon-close',
                promoCarouselFibra: '#promo-carousel-fibra', promoCarouselSatelite: '#promo-carousel-satelite',
                plansContainerFibra: '#plans-container-fibra', plansContainerSatelite: '#plans-container-satelite',
                cityModal: '#city-modal', cityModalPanel: '#city-modal-panel', closeCityModalBtn: '#close-city-modal-btn', citySearchInput: '#city-search-input', cityListContainer: '#city-list-container', cityListError: '#city-list-error', confirmCityBtn: '#confirm-city-btn',
                modalDescription: '#city-modal-description', // Descrição do modal de cidade
                checkoutModal: '#checkout-modal', closeModalBtn: '#close-modal-btn', selectedPlanNameSpan: '#selected-plan-name',
                whatsappFormContainer: '#whatsapp-form-container', whatsappSuccessContainer: '#whatsapp-success', whatsappForm: '#whatsapp-form', whatsappSendLink: '#whatsapp-send-link', radioLabels: '.form-radio-label', radioError: '#radio-error-message',
                cepInput: '#wa-cep', cpfInput: '#wa-cpf', telInput: '#wa-tel1', ruaInput: '#wa-rua', bairroInput: '#wa-bairro', cidadeInput: '#wa-cidade',
            };
            for (const key in nodeSelectors) {
                this.nodes[key] = document.querySelector(nodeSelectors[key]);
            }
        },
        
        /**
         * Busca a lista de cidades do Brasil de uma API pública do IBGE.
         */
        async _setupState() {
            const citiesSP = "Aguaí, Águas de Santa Bárbara, Agudos, Alumínio, Americana, Américo Brasiliense, Amparo, Angatuba, Araçariguama, Araçoiaba da Serra, Arandu, Araraquara, Araras, Arealva, Areiópolis, Artur Nogueira, Atibaia, Avaí, Avaré, Bady Bassitt, Barra Bonita, Barretos, Bauru, Bebedouro, Biritiba-Mirim, Boa Esperança do Sul, Bocaina, Bofete, Boituva, Bom Jesus dos Perdões, Borborema, Borebi, Botucatu, Bragança Paulista, Cabreúva, Caçapava, Cafelândia, Caieiras, Campina do Monte Alegre, Campinas, Campo Limpo Paulista, Cândido Rodrigues, Capela do Alto, Capivari, Casa Branca, Cedral, Cerqueira César, Cerquilho, Cesário Lange, Colina, Conchal, Conchas, Cordeirópolis, Cosmópolis, Cravinhos, Cristais Paulista, Cubatão, Descalvado, Dobrada, Dois Córregos, Dourado, Elias Fausto, Engenheiro Coelho, Estiva Gerbi, Fernando Prestes, Franca, Francisco Morato, Franco da Rocha, Gavião Peixoto, Guaíra, Guapiaçu, Guarantã, Guararema, Guariba, Guarujá, Guatapará, Holambra, Hortolândia, Iaras, Ibaté, Ibitinga, Igaraçu do Tietê, Igaratá, Indaiatuba, Iperó, Iracemápolis, Itaí, Itajobi, Itaju, Itanhaém, Itapetininga, Itápolis, Itapuí, Itatinga, Itirapuã, Itu, Itupeva, Jaborandi, Jaboticabal, Jacareí, Jaguariúna, Jarinu, Jaú, Jumirim, Jundiaí, Laranjal Paulista, Leme, Lençóis Paulista, Limeira, Lindóia, Lins, Louveira, Macatuba, Mairiporã, Manduri, Matão, Mineiros do Tietê, Mirassol, Mogi das Cruzes, Mogi Guaçu, Mogi Mirim, Mongaguá, Monte Alegre do Sul, Monte Alto, Monte Mor, Motuca, Nazaré Paulista, Nova Europa, Nova Odessa, Óleo, Olímpia, Paranapanema, Pardinho, Patrocínio Paulista, Paulínia, Pederneiras, Pedreira, Pereiras, Peruíbe, Pilar do Sul, Pindorama, Piracaia, Piracicaba, Pirajuí, Pirassununga, Piratininga, Pitangueiras, Porangaba, Porto Ferreira, Praia Grande, Pratânia, Presidente Alves, Quadra, Rafard, Ribeirão Bonito, Ribeirão Corrente, Ribeirão Preto, Rincão, Rio Claro, Rio das Pedras, Salesópolis, Saltinho, Salto de Pirapora, Santa Adélia, Santa Bárbara D’Oeste, Santa Branca, Santa Cruz das Palmeiras, Santa Ernestina, Santa Gertrudes, Santa Lúcia, Santa Rita do Passa Quatro, Santa Rosa de Viterbo, Santo Antônio de Posse, Santos, São Bernardo do Campo, São Carlos, São José do Rio Preto, São José dos Campos, São Manuel, São Vicente, Sarapuí, Serra Azul, Serra Negra, Sorocaba, Sumaré, Tabatinga, Tambaú, Taquaritinga, Tatuí, Taubaté, Tietê, Trabiju, Tremembé, Uchoa, Valinhos, Várzea Paulista, Vinhedo, Votorantim";
            this.state.citiesFibra = citiesSP.split(', ').sort();

            try {
                const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
                const citiesData = await response.json();
                this.state.citiesBrazil = citiesData.map(city => `${city.nome} - ${city.microrregiao.mesorregiao.UF.sigla}`).sort();
            } catch (error) {
                console.error("Erro ao buscar cidades do Brasil:", error);
                this.state.citiesBrazil = this.state.citiesFibra;
            }
        },

        _renderDynamicPlans() {
            const planosFibra = this.state.allPlans.filter(p => p.tecnologia === 'Fibra');
            const planosSatelite = this.state.allPlans.filter(p => p.tecnologia === 'Satélite');

            if (this.nodes.promoCarouselFibra) {
                const top3Fibra = planosFibra.slice(0, 3);
                this.nodes.promoCarouselFibra.innerHTML = top3Fibra.map(p => this._createPlanCardHTML(p, true)).join('');
            }
            if (this.nodes.promoCarouselSatelite) {
                const top3Satelite = planosSatelite.slice(0, 3);
                if (top3Satelite.length > 0) {
                    document.getElementById('satelite-section-title')?.classList.remove('hidden');
                    this.nodes.promoCarouselSatelite.innerHTML = top3Satelite.map(p => this._createPlanCardHTML(p, true)).join('');
                }
            }

            if (this.nodes.plansContainerFibra) {
                this.nodes.plansContainerFibra.innerHTML = planosFibra.map(p => this._createPlanCardHTML(p, false)).join('');
            }
            if (this.nodes.plansContainerSatelite) {
                 if (planosSatelite.length > 0) {
                    document.getElementById('satelite-plans-title')?.classList.remove('hidden');
                    this.nodes.plansContainerSatelite.innerHTML = planosSatelite.map(p => this._createPlanCardHTML(p, false)).join('');
                }
            }
        },

        _createPlanCardHTML(plan, isCarouselCell) {
            const valor = (plan.valorPromocional > 0 ? plan.valorPromocional : plan.valorOriginal) || 0;
            const priceParts = valor.toFixed(2).toString().split('.');
            const cardContent = `
                <div class="plan-card flex flex-col h-full" data-plan="${plan.nome}" data-price="R$ ${valor.toFixed(2)}" data-tecnologia="${plan.tecnologia}">
                    <h3 class="text-2xl font-bold text-gray-900">${plan.nome}</h3>
                    <p class="text-gray-500 mb-4">Empresa: ${plan.empresaNome}</p>
                    <div class="my-4 text-gray-800">
                        <p class="flex items-baseline"><span class="text-5xl font-extrabold">R$${priceParts[0]}</span><span class="text-2xl font-bold">,${priceParts[1]}</span><span class="font-medium ml-1">/mês</span></p>
                    </div>
                    <div class="flex-grow">
                        <ul class="space-y-3 mb-8 text-left">
                           ${(plan.inclusoes || '').split('\n').map(item => item.trim() ? `<li class="flex items-center"><i class="fas fa-check-circle text-green-500 mr-2 flex-shrink-0"></i>${item}</li>` : '').join('')}
                        </ul>
                    </div>
                    <button class="contratar-btn w-full bg-gray-800 hover:bg-black text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 flex items-center justify-center gap-2 mt-auto">Contratar Agora <span class="arrow-icon">&rarr;</span></button>
                </div>`;
            return isCarouselCell ? `<div class="carousel-cell">${cardContent}</div>` : cardContent;
        },

        _bindEvents() {
            document.body.addEventListener('click', this._handleBodyClick.bind(this));
            this.nodes.menuBtn?.addEventListener('click', () => this._toggleMobileMenu());
            this.nodes.closeCityModalBtn?.addEventListener('click', () => this._closeCityModal());
            this.nodes.cityModal?.addEventListener('click', e => { if (e.target === this.nodes.cityModal) this._closeCityModal(); });
            this.nodes.citySearchInput?.addEventListener('input', () => this._filterCities());
            this.nodes.cityListContainer?.addEventListener('click', e => this._handleCitySelection(e));
            this.nodes.confirmCityBtn?.addEventListener('click', () => this._confirmCitySelection());
            this.nodes.closeModalBtn?.addEventListener('click', () => this._closeCheckoutModal());
            this.nodes.checkoutModal?.addEventListener('click', e => { if (e.target === this.nodes.checkoutModal) this._closeCheckoutModal(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && !this.nodes.checkoutModal?.classList.contains('hidden')) this._closeCheckoutModal(); });
            this.nodes.whatsappForm?.addEventListener('submit', e => this._handleWhatsappSubmit(e));
            this.nodes.radioLabels?.forEach(label => label.addEventListener('click', e => this._handleRadioChange(e)));
            this._applyInputMask(this.nodes.cpfInput, this._maskCPF);
            this._applyInputMask(this.nodes.telInput, this._maskTel);
            this._applyInputMask(this.nodes.cepInput, this._maskCEP);
            this.nodes.cepInput?.addEventListener('blur', e => this._fetchAddressFromCEP(e.target.value));
        },

        _initPlugins() {
             setTimeout(() => {
                this._initializeFlickity('#promo-carousel-fibra');
                this._initializeFlickity('#promo-carousel-satelite');
            }, 500);
        },
        
         _initializeFlickity(selector) {
            const carousel = document.querySelector(selector);
            if (carousel && typeof Flickity !== 'undefined' && carousel.children.length > 0) {
                if(this.state.flickityInstances[selector]) {
                    this.state.flickityInstances[selector].destroy();
                }
                const flickityInstance = new Flickity(carousel, {
                    wrapAround: true, autoPlay: 5000, pageDots: true, cellAlign: 'left', contain: true
                });
                this.state.flickityInstances[selector] = flickityInstance;
            }
        },

        _handleBodyClick(e) {
            const contratarBtn = e.target.closest('.contratar-btn');
            if (contratarBtn) {
                e.preventDefault();
                const card = contratarBtn.closest('.plan-card');
                if (card) {
                    this.state.selectedPlanInfo = {
                        plan: card.dataset.plan,
                        price: card.dataset.price,
                        tecnologia: card.dataset.tecnologia
                    };
                    this._openCityModal();
                }
            }
        },
        
        _openCityModal() {
            if (!this.nodes.cityModal || !this.nodes.modalDescription) return;

            const tecnologia = this.state.selectedPlanInfo.tecnologia;
            let citiesToList = [];
            let descriptionText = '';

            if (tecnologia === 'Satélite') {
                citiesToList = this.state.citiesBrazil;
                descriptionText = 'Nossa tecnologia via satélite tem cobertura nacional! Por favor, selecione sua cidade para prosseguirmos com o cadastro.';
            } else { // Fibra ou padrão
                citiesToList = this.state.citiesFibra;
                descriptionText = 'Primeiro, digite o nome da sua cidade para verificar se nossos serviços de Fibra Óptica estão disponíveis na sua região.';
            }
            
            this.nodes.modalDescription.textContent = descriptionText;
            this.nodes.citySearchInput.value = ''; 
            this._renderCityList(citiesToList); 
            if (this.nodes.confirmCityBtn) this.nodes.confirmCityBtn.disabled = true; 
            
            this.nodes.cityModal.classList.remove('hidden'); 
            document.body.style.overflow = 'hidden'; 
            setTimeout(() => { 
                this.nodes.cityModalPanel?.classList.remove('opacity-0', '-translate-y-4'); 
                this.nodes.citySearchInput.focus(); 
            }, 50); 
        },

        _closeCityModal() {
            if (!this.nodes.cityModal) return; 
            this.nodes.cityModalPanel?.classList.add('opacity-0', '-translate-y-4'); 
            setTimeout(() => { 
                this.nodes.cityModal.classList.add('hidden'); 
                document.body.style.overflow = 'auto'; 
            }, 300); 
        },

        _openCheckoutModal() {
            if (!this.nodes.checkoutModal || !this.nodes.whatsappForm) return; 
            this.nodes.selectedPlanNameSpan.textContent = this.state.selectedPlanInfo.plan; 
            this.nodes.whatsappForm.dataset.plan = this.state.selectedPlanInfo.plan; 
            this.nodes.whatsappForm.dataset.price = this.state.selectedPlanInfo.price; 
            this.nodes.whatsappForm.reset(); 
            this.nodes.radioLabels.forEach(label => label.classList.remove('is-checked')); 
            this.nodes.whatsappFormContainer.classList.remove('hidden'); 
            this.nodes.whatsappSuccessContainer.classList.add('hidden'); 
            this.nodes.checkoutModal.classList.remove('hidden'); 
            document.body.style.overflow = 'hidden'; 
            this.nodes.checkoutModal.focus(); 
        },

        _closeCheckoutModal() {
            if (!this.nodes.checkoutModal) return; 
            this.nodes.checkoutModal.classList.add('hidden'); 
            document.body.style.overflow = 'auto'; 
        },

        _toggleMobileMenu() { if (!this.nodes.menuBtn || !this.nodes.mobileMenu) return; const isExpanded = this.nodes.menuBtn.getAttribute('aria-expanded') === 'true'; this.nodes.menuBtn.setAttribute('aria-expanded', !isExpanded); this.nodes.mobileMenu.classList.toggle('hidden'); this.nodes.menuIconOpen?.classList.toggle('hidden'); this.nodes.menuIconClose?.classList.toggle('hidden'); },
        _normalizeText: text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
        _renderCityList(cities) { if (!this.nodes.cityListContainer || !this.nodes.cityListError) return; this.nodes.cityListContainer.innerHTML = ''; this.nodes.cityListError.classList.toggle('hidden', cities.length > 0); const fragment = document.createDocumentFragment(); cities.forEach(city => { const cityButton = document.createElement('button'); cityButton.className = 'w-full text-left px-4 py-2 text-gray-700 hover:bg-yellow-50 hover:text-brand-gold transition-colors duration-150 rounded'; cityButton.textContent = city; cityButton.type = 'button'; fragment.appendChild(cityButton); }); this.nodes.cityListContainer.appendChild(fragment); },
        _filterCities() {
            const tecnologia = this.state.selectedPlanInfo.tecnologia;
            const sourceList = tecnologia === 'Satélite' ? this.state.citiesBrazil : this.state.citiesFibra;
            const searchTerm = this._normalizeText(this.nodes.citySearchInput.value);
            const filtered = sourceList.filter(city => this._normalizeText(city).includes(searchTerm));
            this._renderCityList(filtered);
            this._validateCitySelection();
        },
        _handleCitySelection(e) { if (e.target.tagName === 'BUTTON') { this.nodes.citySearchInput.value = e.target.textContent; this._filterCities(); if (this.nodes.confirmCityBtn) this.nodes.confirmCityBtn.focus(); } },
        _validateCitySelection() {
            const tecnologia = this.state.selectedPlanInfo.tecnologia;
            const sourceList = tecnologia === 'Satélite' ? this.state.citiesBrazil : this.state.citiesFibra;
            const currentInput = this.nodes.citySearchInput.value;
            const isValid = sourceList.some(city => city === currentInput);
            if (this.nodes.confirmCityBtn) this.nodes.confirmCityBtn.disabled = !isValid;
        },
        _confirmCitySelection() { this._openCheckoutModal(); this._closeCityModal(); },
        _applyInputMask(input, maskFunction) { if (input) { input.addEventListener('input', (e) => { e.target.value = maskFunction(e.target.value); }); } },
        _maskCPF: value => value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
        _maskTel: value => value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1'),
        _maskCEP: value => value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1'),
        async _fetchAddressFromCEP(cep) { 
            const cleanCep = cep.replace(/\D/g, ''); 
            if (cleanCep.length !== 8) return; 
            try { 
                const response = await fetch(`${this.config.viacepUrl}${cleanCep}/json/`); 
                if (!response.ok) throw new Error('CEP não encontrado'); 
                const address = await response.json(); 
                if (address.erro) throw new Error('CEP inválido'); 
                if (this.nodes.ruaInput) this.nodes.ruaInput.value = address.logradouro || ''; 
                if (this.nodes.bairroInput) this.nodes.bairroInput.value = address.bairro || ''; 
                if (this.nodes.cidadeInput) this.nodes.cidadeInput.value = address.localidade || ''; 
            } catch (error) { 
                console.error("Erro ao buscar CEP:", error); 
            } 
        },
        _handleRadioChange(event) { const currentLabel = event.currentTarget; this.nodes.radioLabels.forEach(label => label.classList.remove('is-checked')); currentLabel.classList.add('is-checked'); if(this.nodes.radioError) this.nodes.radioError.textContent = ''; },
        async _handleWhatsappSubmit(e) { 
            e.preventDefault(); 
            const formData = new FormData(this.nodes.whatsappForm); 
            const data = Object.fromEntries(formData.entries()); 
            const { plan, price } = this.nodes.whatsappForm.dataset; 
            const message = `✨ NOVO PEDIDO DE CADASTRO ✨\n-----------------------------------\nPlano Escolhido: *${plan}*\nValor: *${price}*\n-----------------------------------\n🔹 NOME COMPLETO: ${data['wa-nome']}\n🔹 NOME DA MÃE: ${data['wa-mae']}\n🔹 DATA DE NASCIMENTO: ${data['wa-nascimento']}\n🔹 CPF: ${data['wa-cpf']}\n🔹 RG: ${data['wa-rg']}\n📧 E-MAIL: ${data['wa-email']}\n🔹 TELEFONE TITULAR: ${data['wa-tel1']}\n🔹 ENDEREÇO: Rua ${data['wa-rua']}, Nº ${data['wa-numero']}, Bairro ${data['wa-bairro']}, Cidade ${data['wa-cidade']}, CEP ${data['wa-cep']}\n🔹 INSTALAÇÃO: ${data.installation_period}`; 
            
            if (this.nodes.whatsappSendLink) {
                this.nodes.whatsappSendLink.href = `https://wa.me/${this.config.whatsappNumber}?text=${encodeURIComponent(message)}`;
            }
            this.nodes.whatsappFormContainer.classList.add('hidden'); 
            this.nodes.whatsappSuccessContainer.classList.remove('hidden'); 
        },
    }
    
    // Inicia a aplicação.
    App.init();
});
