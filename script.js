/**
 * @file Script principal para a página da Piel Telecom.
 * @summary Gerencia a interatividade do menu, modais, formulários, e as IAs de recomendação e conversação.
 * @version 4.0.0 - Edição Refatorada
 * @description Esta versão centraliza os dados dos planos como uma "Fonte Única de Verdade" no JavaScript,
 * eliminando a redundância do HTML e corrigindo bugs críticos de escopo na IA Jarvis.
 */

document.addEventListener('DOMContentLoaded', () => {

    /**
     * @module App
     * @description Objeto principal que encapsula toda a lógica da aplicação.
     */
    const App = {
        /**
         * Configurações estáticas e chaves da aplicação.
         */
        config: {
            whatsappNumber: '5513992006688',
            geminiApiKey: "AIzaSyDB3RFLt-hjYFWhtBKyqgVodWt4LqNoe_w", // Sua chave de API foi mantida.
            viacepUrl: 'https://viacep.com.br/ws/',
            geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=',
            desktopBreakpoint: '(min-width: 1024px)',
        },

        /**
         * Estado dinâmico da aplicação.
         */
        state: {
            selectedPlanInfo: {},
            availableCities: [],
            allPlans: [], 
            flickityRecommended: null,
        },

        /**
         * REESTRUTURADO: A base de conhecimento agora é a fonte única de verdade para os planos.
         * Fica no nível do App para ser compartilhada entre a IA de recomendação e o Jarvis.
         */
        knowledge: {
            plans: { 
                "Fibra-Home-200M": { nome: "Fibra Home 200M+", preco: "R$79,99", download: "200 Mbps", upload: "100 Mbps", perfil: "Orçamento limitado, uso básico (redes sociais, vídeos HD).", argumento: "Upload de 100 Mega, um bom diferencial para essa faixa de preço." }, 
                "Fibra-Home-400M": { nome: "Fibra Home 400M+", preco: "R$94,99", download: "400 Mbps", upload: "200 Mbps", perfil: "Família (uso simultâneo) e Home Office (videochamadas).", argumento: "200 Mega de upload, essencial para videochamadas com ótima qualidade e envio rápido de arquivos." }, 
                "Fibra-Home-600M": { nome: "Fibra Home 600M+", preco: "R$99,99", download: "600 Mbps", upload: "300 Mbps", perfil: "Melhor custo-benefício, famílias, streaming 4K.", argumento: "Por apenas R$ 5 a mais que o plano de 400M, o senhor leva 200 Mega a mais de download. É um salto de performance muito grande por uma diferença mínima." },
                "Fibra-Home-600M-Max": { nome: "Fibra Home 600M+ Max", preco: "R$119,99", download: "600 Mbps", upload: "300 Mbps", perfil: "Para quem precisa de melhor cobertura de sinal em casa.", argumento: "Este plano inclui um hardware superior, como um roteador Wi-Fi 6, para garantir que o sinal de Wi-Fi chegue com força total em mais ambientes." },
                "Fibra-Home-1G": { nome: "Fibra Home 1G+", preco: "R$119,99", download: "1 Gbps", upload: "500 Mbps", perfil: "Alta velocidade, máxima performance e downloads rápidos.", argumento: "Se o foco é ter a velocidade bruta para baixar jogos rapidamente, este plano de 1 Giga entrega uma experiência fantástica." },
                "Fibra-Home-1G-Gamer": { nome: "Fibra Home 1G+ Gamer", preco: "R$169,99", download: "1 Gbps", upload: "500 Mbps", perfil: "Gamers competitivos e streamers (baixa latência e alto upload).", argumento: "Ping baixo é tudo. Este plano tem rotas otimizadas para servidores de jogos, e com 500 Mega de upload, suas lives ficam com qualidade profissional." },
                "Fibra-Home-1G-Home-Office": { nome: "Fibra Home 1G+ Home Office", preco: "R$169,99", download: "1 Gbps", upload: "500 Mbps", perfil: "Profissionais que precisam de máxima estabilidade para trabalho remoto.", argumento: "Plano pensado para o profissional. Tem otimização para as principais ferramentas de trabalho, garantindo que sua internet não falhe numa reunião importante." },
                "Fibra-Home-1G-Black": { nome: "Fibra Home 1G+ Black", preco: "R$199,99", download: "1 Gbps", upload: "500 Mbps", perfil: "Heavy users e casas automatizadas com muitos dispositivos.", argumento: "Para quem precisa de velocidade e de um sinal que cubra a casa toda, o plano Black vem com equipamentos premium (Wi-Fi 6/6E)." },
                "Fibra-Home-1G-Black-Disney": { nome: "Fibra Home 1G+ Black c/ Disney+", preco: "R$239,99", download: "1 Gbps", upload: "500 Mbps", perfil: "Pacote completo com internet e entretenimento familiar.", argumento: "A internet mais rápida, equipamentos premium e Disney+ inclusos numa só fatura." },
                "Fibra-Home-Socio-Torcedor": { nome: "Fibra Home Socio Ponte Preta ou Guarani", preco: "Preço Especial", download: "800 Mbps", upload: "400 Mbps", perfil: "Exclusivo para sócios torcedores da Ponte Preta ou Guarani.", argumento: "Se você é torcedor de coração, temos um plano exclusivo que, além de ter uma super velocidade, ainda ajuda o seu time." },
                "Fibra-Home-Combo-Movel": { nome: "Fibra Home 600M+ Combo Móvel", preco: "Consultar", download: "600 Mbps", upload: "300 Mbps", perfil: "Clientes que precisam de plano de celular e querem unificar as contas.", argumento: "Resolva tudo de uma vez. Com nosso combo, você leva uma internet de 600 Mega e um plano de celular em uma conta só." } 
            }
        },

        nodes: {},

        /**
         * Ponto de entrada da aplicação.
         */
        init() {
            // CORRIGIDO: O estado `allPlans` agora é populado a partir da nova fonte única de verdade.
            this.state.allPlans = Object.entries(this.knowledge.plans).map(([id, details]) => ({ id, ...details }));
            
            this._mapDOMNodes();
            this._setupState();
            this._renderAllPlans(); 
            this._bindEvents();
            this._initPlugins();
            
            // O Jarvis é inicializado por último, recebendo o 'App' como seu pai/contexto.
            this.jarvis.init(this);
            console.log("Aplicação Piel Telecom v4.0.0 inicializada com sucesso. 🚀");
        },

        // =======================================================
        // MÉTODOS DE INICIALIZAÇÃO E CONFIGURAÇÃO
        // =======================================================

        _mapDOMNodes() {
            const nodeSelectors = {
                menuBtn: '#menu-btn', mobileMenu: '#mobile-menu', menuIconOpen: '#menu-icon-open', menuIconClose: '#menu-icon-close', mobileMenuLinks: '.mobile-menu-link',
                fadeInElements: '.fade-in-element',
                promoCarousel: '#promo-carousel',
                recommendBtn: '#recommend-btn', needsInput: '#needs-input', recommendLoader: '#recommend-loader', recommenderError: '#recommender-error', recommendedContainer: '#recommended-plans-container', recommendedGrid: '#recommended-plans-grid', allPlansContainer: '#all-plans-container', allPlansStorage: '#all-plans-storage',
                cityModal: '#city-modal', cityModalPanel: '#city-modal-panel', closeCityModalBtn: '#close-city-modal-btn', citySearchInput: '#city-search-input', cityListContainer: '#city-list-container', cityListError: '#city-list-error', confirmCityBtn: '#confirm-city-btn',
                checkoutModal: '#checkout-modal', closeModalBtn: '#close-modal-btn', selectedPlanNameSpan: '#selected-plan-name',
                whatsappFormContainer: '#whatsapp-form-container', whatsappSuccessContainer: '#whatsapp-success', whatsappForm: '#whatsapp-form', whatsappSendLink: '#whatsapp-send-link', radioLabels: '.form-radio-label', radioError: '#radio-error-message',
                cepInput: '#wa-cep', cpfInput: '#wa-cpf', telInput: '#wa-tel1', ruaInput: '#wa-rua', bairroInput: '#wa-bairro', cidadeInput: '#wa-cidade',
            };
            for (const key in nodeSelectors) {
                if (key.endsWith('Links') || key.endsWith('Elements') || key.endsWith('Labels')) {
                    this.nodes[key] = document.querySelectorAll(nodeSelectors[key]);
                } else {
                    this.nodes[key] = document.querySelector(nodeSelectors[key]);
                }
            }
        },
        
        _setupState() {
            const citiesString = "Aguaí, Águas de Santa Bárbara, Agudos, Alumínio, Americana, Américo Brasiliense, Amparo, Angatuba, Araçariguama, Araçoiaba da Serra, Arandu, Araraquara, Araras, Arealva, Areiópolis, Artur Nogueira, Atibaia, Avaí, Avaré, Bady Bassitt, Barra Bonita, Barretos, Bauru, Bebedouro, Biritiba-Mirim, Boa Esperança do Sul, Bocaina, Bofete, Boituva, Bom Jesus dos Perdões, Borborema, Borebi, Botucatu, Bragança Paulista, Cabreúva, Caçapava, Cafelândia, Caieiras, Campina do Monte Alegre, Campinas, Campo Limpo Paulista, Cândido Rodrigues, Capela do Alto, Capivari, Casa Branca, Cedral, Cerqueira César, Cerquilho, Cesário Lange, Colina, Conchal, Conchas, Cordeirópolis, Cosmópolis, Cravinhos, Cristais Paulista, Cubatão, Descalvado, Dobrada, Dois Córregos, Dourado, Elias Fausto, Engenheiro Coelho, Estiva Gerbi, Fernando Prestes, Franca, Francisco Morato, Franco da Rocha, Gavião Peixoto, Guaíra, Guapiaçu, Guarantã, Guararema, Guariba, Guarujá, Guatapará, Holambra, Hortolândia, Iaras, Ibaté, Ibitinga, Igaraçu do Tietê, Igaratá, Indaiatuba, Iperó, Iracemápolis, Itaí, Itajobi, Itaju, Itanhaém, Itapetininga, Itápolis, Itapuí, Itatinga, Itirapuã, Itu, Itupeva, Jaborandi, Jaboticabal, Jacareí, Jaguariúna, Jarinu, Jaú, Jumirim, Jundiaí, Laranjal Paulista, Leme, Lençóis Paulista, Limeira, Lindóia, Lins, Louveira, Macatuba, Mairiporã, Manduri, Matão, Mineiros do Tietê, Mirassol, Mogi das Cruzes, Mogi Guaçu, Mogi Mirim, Mongaguá, Monte Alegre do Sul, Monte Alto, Monte Mor, Motuca, Nazaré Paulista, Nova Europa, Nova Odessa, Óleo, Olímpia, Paranapanema, Pardinho, Patrocínio Paulista, Paulínia, Pederneiras, Pedreira, Pereiras, Peruíbe, Pilar do Sul, Pindorama, Piracaia, Piracicaba, Pirajuí, Pirassununga, Piratininga, Pitangueiras, Porangaba, Porto Ferreira, Praia Grande, Pratânia, Presidente Alves, Quadra, Rafard, Ribeirão Bonito, Ribeirão Corrente, Ribeirão Preto, Rincão, Rio Claro, Rio das Pedras, Salesópolis, Saltinho, Salto de Pirapora, Santa Adélia, Santa Bárbara D’Oeste, Santa Branca, Santa Cruz das Palmeiras, Santa Ernestina, Santa Gertrudes, Santa Lúcia, Santa Rita do Passa Quatro, Santa Rosa de Viterbo, Santo Antônio de Posse, Santos, São Bernardo do Campo, São Carlos, São José do Rio Preto, São José dos Campos, São Manuel, São Vicente, Sarapuí, Serra Azul, Serra Negra, Sorocaba, Sumaré, Tabatinga, Tambaú, Taquaritinga, Tatuí, Taubaté, Tietê, Trabiju, Tremembé, Uchoa, Valinhos, Várzea Paulista, Vinhedo, Votorantim";
            this.state.availableCities = citiesString.split(', ').sort();
        },

        /**
         * MELHORIA: Renderiza todos os planos dinamicamente a partir da fonte única de verdade.
         * Isso elimina a necessidade de ter os planos hardcoded no HTML.
         */
        _renderAllPlans() {
            const promoFragment = document.createDocumentFragment();
            const storageFragment = document.createDocumentFragment();
            const promoPlanIds = ["Fibra-Home-200M", "Fibra-Home-600M", "Fibra-Home-1G"];

            this.state.allPlans.forEach(plan => {
                const planCard = document.createElement('div');
                planCard.id = plan.id;
                planCard.className = 'plan-card';
                planCard.dataset.price = plan.preco;
                planCard.dataset.plan = plan.nome;
                
                const features = [];
                if(plan.download) features.push(`Download: ${plan.download}`);
                if(plan.upload) features.push(`Upload: ${plan.upload}`);
                if(plan.argumento && promoPlanIds.includes(plan.id)) features.push(plan.argumento);


                planCard.innerHTML = `
                    <h3 class="text-2xl font-bold text-gray-900">${plan.nome}</h3>
                    <p class="text-gray-500 mb-4">${plan.perfil}</p>
                    <div class="my-4 text-gray-800"><p class="text-4xl font-extrabold">${plan.preco}</p></div>
                    <div class="flex-grow">
                        <ul class="space-y-3 mb-8 text-left">
                            ${features.map(f => `<li class="flex items-center"><i class="fas fa-check-circle text-green-500 mr-2 flex-shrink-0"></i><span>${f}</span></li>`).join('')}
                        </ul>
                    </div>
                    <div class="gemini-reason-container mt-auto"></div>
                    <button class="contratar-btn w-full bg-gray-800 hover:bg-black text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 flex items-center justify-center gap-2 mt-4">Contratar Agora <span class="arrow-icon">&rarr;</span></button>
                `;

                // Adiciona uma cópia ao carrossel de promoção se for um plano promocional
                if (promoPlanIds.includes(plan.id)) {
                    const carouselCell = document.createElement('div');
                    carouselCell.className = 'carousel-cell';
                    carouselCell.appendChild(planCard.cloneNode(true));
                    promoFragment.appendChild(carouselCell);
                }
                // Adiciona o card original ao template de armazenamento
                storageFragment.appendChild(planCard);
            });

            if (this.nodes.promoCarousel) {
                this.nodes.promoCarousel.innerHTML = ''; // Limpa antes de adicionar
                this.nodes.promoCarousel.appendChild(promoFragment);
            }
            if (this.nodes.allPlansStorage) {
                // O conteúdo do template é acessado via .content
                this.nodes.allPlansStorage.content.innerHTML = ''; // Limpa antes de adicionar
                this.nodes.allPlansStorage.content.appendChild(storageFragment);
            }
        },

        _bindEvents() {
            document.body.addEventListener('click', this._handleBodyClick.bind(this));
            this.nodes.menuBtn?.addEventListener('click', () => this._toggleMobileMenu());
            this.nodes.mobileMenuLinks?.forEach(link => link.addEventListener('click', () => this._toggleMobileMenu()));
            this.nodes.recommendBtn?.addEventListener('click', () => this._handleRecommendation());
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
            window.addEventListener('resize', () => this._updateRecommendedPlansLayout());
        },

        _initPlugins() {
            // Lógica do IntersectionObserver para animações de fade-in
            if ('IntersectionObserver' in window && this.nodes.fadeInElements?.length) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('is-visible');
                            observer.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.1 });
                this.nodes.fadeInElements.forEach(el => observer.observe(el));
            }
            // Lógica do carrossel Flickity
            if (this.nodes.promoCarousel && typeof Flickity !== 'undefined') {
                let promoFlickity = null;
                const mediaQuery = window.matchMedia('(max-width: 1023px)');

                const handleCarousel = (e) => {
                    if (e.matches) {
                        if (!promoFlickity) {
                            promoFlickity = new Flickity(this.nodes.promoCarousel, {
                                wrapAround: true, autoPlay: 5000, pageDots: true, cellAlign: 'left', contain: true, imagesLoaded: true
                            });
                        }
                    } else {
                        if (promoFlickity) {
                            promoFlickity.destroy();
                            promoFlickity = null;
                        }
                    }
                };
                handleCarousel(mediaQuery);
                mediaQuery.addEventListener('change', handleCarousel);
            }
        },

        // ... (Todos os outros métodos de utilidade, modais e formulários permanecem os mesmos) ...
        _displayUserError(message, errorElement) { if (errorElement) { errorElement.textContent = message; errorElement.classList.remove('hidden'); } },
        _normalizeText: text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
        _toggleMobileMenu() { if (!this.nodes.menuBtn || !this.nodes.mobileMenu) return; const isExpanded = this.nodes.menuBtn.getAttribute('aria-expanded') === 'true'; this.nodes.menuBtn.setAttribute('aria-expanded', !isExpanded); this.nodes.mobileMenu.classList.toggle('hidden'); this.nodes.menuIconOpen?.classList.toggle('hidden'); this.nodes.menuIconClose?.classList.toggle('hidden'); },
        
        async _handleRecommendation() {
            const userInput = this.nodes.needsInput.value.trim();
            if (!userInput) { this._displayUserError("Por favor, descreva sua necessidade para a IA.", this.nodes.recommenderError); return; }
            if (!this.config.geminiApiKey.startsWith("AIza")) { this._displayUserError("A chave da API do Google não foi configurada ou é inválida.", this.nodes.recommenderError); console.error("Chave de API do Gemini inválida ou não configurada no objeto App.config."); return; }
            
            this.nodes.recommenderError?.classList.add('hidden');
            this.nodes.recommendLoader?.classList.remove('hidden');
            if (this.nodes.recommendBtn) this.nodes.recommendBtn.disabled = true;

            const prompt = `Você é um assistente especialista em vendas de planos de internet da empresa Piel Telecom. Sua tarefa é analisar a necessidade de um cliente e recomendar os 3 melhores planos de internet para ele, com base na lista de planos disponíveis. **Necessidade do Cliente:** "${userInput}" **Lista de Planos Disponíveis (formato JSON):** ${JSON.stringify(this.state.allPlans, null, 2)} **Instruções:** 1. Analise a necessidade do cliente e compare com os detalhes de cada plano. 2. Selecione os 3 planos mais adequados. 3. Para cada plano recomendado, escreva uma justificativa curta e amigável (em português do Brasil). 4. Retorne sua resposta estritamente no formato JSON especificado no schema. Não inclua nenhuma outra informação ou texto fora do JSON. 5. IMPORTANTE: Assegure que o JSON de saída seja perfeitamente válido. O campo "reason" deve ser uma string única, sem quebras de linha literais e com aspas duplas devidamente escapadas (\\").`;
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { "recommendations": { type: "ARRAY", items: { type: "OBJECT", properties: { "planId": { "type": "STRING" }, "reason": { "type": "STRING" } }, required: ["planId", "reason"] } } }, required: ["recommendations"] } } };
            const apiUrl = `${this.config.geminiApiUrl}${this.config.geminiApiKey}`;

            try {
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) { const errorBody = await response.text(); console.error("API Error Response:", errorBody); throw new Error(`API Error: ${response.status}`); }
                const result = await response.json();
                const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!jsonText) { throw new Error("A resposta da IA está vazia ou em formato inesperado."); }
                this._renderRecommendations(JSON.parse(jsonText));
            } catch (error) {
                console.error("Falha detalhada na recomendação da API Gemini:", error);
                let userMessage = "Desculpe, a IA não conseguiu gerar uma recomendação. Tente novamente.";
                if (error.message.includes("API Error: 400")) { userMessage = "Ocorreu um erro na requisição à IA (Bad Request). Verifique o console para mais detalhes."; }
                else if (error.message.includes("API Error: 403")) { userMessage = "Erro de permissão. Verifique se a chave de API é válida e está habilitada para o serviço Gemini."; }
                else if (error.message.includes("inesperado")) { userMessage = "A IA retornou uma resposta em um formato inesperado. Tente reformular sua necessidade."; }
                this._displayUserError(userMessage, this.nodes.recommenderError);
            } finally {
                this.nodes.recommendLoader?.classList.add('hidden');
                if (this.nodes.recommendBtn) this.nodes.recommendBtn.disabled = false;
            }
        },

        _renderRecommendations(result) {
            if (!this.nodes.recommendedGrid) return;
            if (this.state.flickityRecommended) { this.state.flickityRecommended.destroy(); this.state.flickityRecommended = null; }
            this.nodes.recommendedGrid.innerHTML = '';
            if (!result.recommendations?.length) { this._displayUserError("Não foram encontradas recomendações adequadas.", this.nodes.recommenderError); return; }

            result.recommendations.forEach(rec => {
                const originalCard = this.nodes.allPlansStorage.content.getElementById(rec.planId);
                if (originalCard) {
                    const clonedCardContainer = document.createElement('div');
                    clonedCardContainer.className = 'carousel-cell w-full sm:w-1/2 lg:w-1/3 px-2';
                    const clonedCard = originalCard.cloneNode(true);
                    const reasonContainer = clonedCard.querySelector('.gemini-reason-container');
                    if (reasonContainer) { reasonContainer.innerHTML = `<div class="p-3 mt-4 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-yellow-800 rounded-r-lg"><strong>✨ Recomendação da IA:</strong> ${rec.reason}</div>`; }
                    clonedCardContainer.appendChild(clonedCard);
                    this.nodes.recommendedGrid.appendChild(clonedCardContainer);
                }
            });
            
            this.nodes.allPlansContainer?.classList.add('hidden');
            this.nodes.recommendedContainer?.classList.remove('hidden');
            this._updateRecommendedPlansLayout();
            this.nodes.recommendedContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },

        _updateRecommendedPlansLayout() {
            if (!this.nodes.recommendedGrid || typeof Flickity === 'undefined') return;
            const isDesktop = window.matchMedia(this.config.desktopBreakpoint).matches;
            this.nodes.recommendedGrid.classList.toggle('lg:flex', isDesktop);
            this.nodes.recommendedGrid.classList.toggle('lg:justify-center', isDesktop);
            if (isDesktop) { if (this.state.flickityRecommended) { this.state.flickityRecommended.destroy(); this.state.flickityRecommended = null; } }
            else { if (!this.state.flickityRecommended && this.nodes.recommendedGrid.children.length > 0) { this.state.flickityRecommended = new Flickity(this.nodes.recommendedGrid, { wrapAround: true, pageDots: true, cellAlign: 'left', contain: true, imagesLoaded: true }); } }
        },
        
        _handleBodyClick(e) { const contratarBtn = e.target.closest('.contratar-btn'); if (contratarBtn) { e.preventDefault(); const card = contratarBtn.closest('.plan-card'); if (card) { this.state.selectedPlanInfo = { plan: card.dataset.plan, price: card.dataset.price }; this._openCityModal(); } } },
        _openCityModal() { if (!this.nodes.cityModal) return; this.nodes.citySearchInput.value = ''; this._renderCityList(this.state.availableCities); if (this.nodes.confirmCityBtn) this.nodes.confirmCityBtn.disabled = true; this.nodes.cityModal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; setTimeout(() => { this.nodes.cityModalPanel?.classList.remove('opacity-0', '-translate-y-4'); this.nodes.citySearchInput.focus(); }, 50); },
        _closeCityModal() { if (!this.nodes.cityModal) return; this.nodes.cityModalPanel?.classList.add('opacity-0', '-translate-y-4'); setTimeout(() => { this.nodes.cityModal.classList.add('hidden'); document.body.style.overflow = 'auto'; }, 300); },
        _openCheckoutModal() { if (!this.nodes.checkoutModal || !this.nodes.whatsappForm) return; this.nodes.selectedPlanNameSpan.textContent = this.state.selectedPlanInfo.plan; this.nodes.whatsappForm.dataset.plan = this.state.selectedPlanInfo.plan; this.nodes.whatsappForm.dataset.price = this.state.selectedPlanInfo.price; this.nodes.whatsappForm.reset(); this._clearFormErrors(); this.nodes.radioLabels.forEach(label => label.classList.remove('is-checked')); this.nodes.whatsappFormContainer.classList.remove('hidden'); this.nodes.whatsappSuccessContainer.classList.add('hidden'); this.nodes.checkoutModal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; this.nodes.checkoutModal.focus(); },
        _closeCheckoutModal() { if (!this.nodes.checkoutModal) return; this.nodes.checkoutModal.classList.add('hidden'); document.body.style.overflow = 'auto'; },
        _renderCityList(cities) { if (!this.nodes.cityListContainer || !this.nodes.cityListError) return; this.nodes.cityListContainer.innerHTML = ''; this.nodes.cityListError.classList.toggle('hidden', cities.length > 0); const fragment = document.createDocumentFragment(); cities.forEach(city => { const cityButton = document.createElement('button'); cityButton.className = 'w-full text-left px-4 py-2 text-gray-700 hover:bg-yellow-50 hover:text-brand-gold transition-colors duration-150 rounded'; cityButton.textContent = city; cityButton.type = 'button'; fragment.appendChild(cityButton); }); this.nodes.cityListContainer.appendChild(fragment); },
        _filterCities() { const searchTerm = this._normalizeText(this.nodes.citySearchInput.value); const filtered = this.state.availableCities.filter(city => this._normalizeText(city).includes(searchTerm)); this._renderCityList(filtered); this._validateCitySelection(); },
        _handleCitySelection(e) { if (e.target.tagName === 'BUTTON') { this.nodes.citySearchInput.value = e.target.textContent; this._filterCities(); if (this.nodes.confirmCityBtn) this.nodes.confirmCityBtn.focus(); } },
        _validateCitySelection() { const currentInput = this._normalizeText(this.nodes.citySearchInput.value); const isValid = this.state.availableCities.some(city => this._normalizeText(city) === currentInput); if (this.nodes.confirmCityBtn) this.nodes.confirmCityBtn.disabled = !isValid; },
        _confirmCitySelection() { this._openCheckoutModal(); this._closeCityModal(); },
        _applyInputMask(input, maskFunction) { if (input) { input.addEventListener('input', (e) => { e.target.value = maskFunction(e.target.value); }); } },
        _maskCPF: value => value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
        _maskTel: value => value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1'),
        _maskCEP: value => value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1'),
        async _fetchAddressFromCEP(cep) { const cleanCep = cep.replace(/\D/g, ''); if (cleanCep.length !== 8) return; try { const response = await fetch(`${this.config.viacepUrl}${cleanCep}/json/`); if (!response.ok) throw new Error('CEP não encontrado'); const address = await response.json(); if (address.erro) throw new Error('CEP inválido'); if (this.nodes.ruaInput) this.nodes.ruaInput.value = address.logradouro || ''; if (this.nodes.bairroInput) this.nodes.bairroInput.value = address.bairro || ''; if (this.nodes.cidadeInput) this.nodes.cidadeInput.value = address.localidade || ''; } catch (error) { console.error("Erro ao buscar CEP:", error); } },
        _validateField(input) { let isValid = input.checkValidity(); const errorContainer = input.nextElementSibling; if (input.name === 'wa-cpf') isValid = isValid && /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(input.value); if (input.name === 'wa-tel1') isValid = isValid && /^\(\d{2}\) \d{5}-\d{4}$/.test(input.value); if (input.name === 'wa-cep') isValid = isValid && /^\d{5}-\d{3}$/.test(input.value); if (errorContainer?.classList.contains('error-message')) { input.classList.toggle('is-invalid', !isValid); errorContainer.textContent = isValid ? '' : (input.validationMessage || 'Campo inválido.'); } return isValid; },
        _clearFormErrors() { if (!this.nodes.whatsappForm) return; this.nodes.whatsappForm.querySelectorAll('.form-input').forEach(input => { input.classList.remove('is-invalid'); const errorEl = input.nextElementSibling; if (errorEl?.classList.contains('error-message')) { errorEl.textContent = ''; } }); if (this.nodes.radioError) this.nodes.radioError.textContent = ''; },
        _handleRadioChange(event) { const currentLabel = event.currentTarget; this.nodes.radioLabels.forEach(label => label.classList.remove('is-checked')); currentLabel.classList.add('is-checked'); if(this.nodes.radioError) this.nodes.radioError.textContent = ''; },
        async _handleWhatsappSubmit(e) { e.preventDefault(); this._clearFormErrors(); let isFormValid = Array.from(this.nodes.whatsappForm.querySelectorAll('input[required]:not([type=radio])')).every(input => this._validateField(input)); const radioChecked = this.nodes.whatsappForm.querySelector('input[name="installation_period"]:checked'); if (!radioChecked) { if(this.nodes.radioError) this.nodes.radioError.textContent = 'Por favor, selecione um período.'; isFormValid = false; } if (!isFormValid) return; const formData = new FormData(this.nodes.whatsappForm); const data = Object.fromEntries(formData.entries()); const { plan, price } = this.nodes.whatsappForm.dataset; const message = `✨ NOVO PEDIDO DE CADASTRO ✨\n-----------------------------------\nPlano Escolhido: *${plan}*\nValor: *${price}*\n-----------------------------------\n🔹 NOME COMPLETO: ${data['wa-nome']}\n🔹 NOME DA MÃE: ${data['wa-mae']}\n🔹 DATA DE NASCIMENTO: ${data['wa-nascimento']}\n🔹 CPF: ${data['wa-cpf']}\n🔹 RG: ${data['wa-rg']}\n📧 E-MAIL: ${data['wa-email']}\n🔹 TELEFONE TITULAR: ${data['wa-tel1']}\n🔹 ENDEREÇO: Rua ${data['wa-rua']}, Nº ${data['wa-numero']}, Bairro ${data['wa-bairro']}, Cidade ${data['wa-cidade']}, CEP ${data['wa-cep']}\n🔹 INSTALAÇÃO: ${data.installation_period}`; if (this.nodes.whatsappSendLink) this.nodes.whatsappSendLink.href = `https://wa.me/${this.config.whatsappNumber}?text=${encodeURIComponent(message)}`; this.nodes.whatsappFormContainer.classList.add('hidden'); this.nodes.whatsappSuccessContainer.classList.remove('hidden'); },

        // =======================================================
        // MÓDULO JARVIS - IA DE CONVERSAÇÃO
        // =======================================================
        jarvis: {
            parent: null,
            nodes: {},
            state: { session: null, isOpen: false, },
            
            init(parent) { 
                this.parent = parent; // O `parent` é o objeto `App` principal
                this._mapDOMNodes(); 
                this._bindEvents(); 
            },

            _mapDOMNodes() {
                this.nodes = { // O Jarvis gerencia apenas os nós do seu próprio widget
                    chatButton: document.querySelector('#jarvis-chat-button'),
                    chatContainer: document.querySelector('#jarvis-chat-container'),
                    chatLog: document.querySelector('#jarvis-chat-log'),
                    userInput: document.querySelector('#jarvis-user-input'),
                    sendButton: document.querySelector('#jarvis-send-button'),
                    openIcon: document.querySelector('#jarvis-chat-button .fa-comment-dots'),
                    closeIcon: document.querySelector('#jarvis-chat-button .fa-times'),
                    mobileCloseBtn: document.querySelector('#jarvis-close-btn-mobile'),
                };
            },

            _bindEvents() {
                this.nodes.chatButton?.addEventListener('click', () => this.toggleChat());
                this.nodes.mobileCloseBtn?.addEventListener('click', () => this.toggleChat());
                this.nodes.sendButton?.addEventListener('click', () => this.sendUserMessage());
                this.nodes.userInput?.addEventListener('keydown', e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendUserMessage(); }
                });
            },

            toggleChat() {
                if (!this.nodes.chatContainer) return;
                this.state.isOpen = this.nodes.chatContainer.classList.toggle('is-open');
                this.nodes.openIcon?.classList.toggle('hidden', this.state.isOpen);
                this.nodes.closeIcon?.classList.toggle('hidden', !this.state.isOpen);
                if (this.state.isOpen && !this.state.session) { this._initSession(); }
                if(this.state.isOpen) this.nodes.userInput.focus();
            },

            async sendUserMessage() {
                const message = this.nodes.userInput.value.trim();
                if (message === '' || this.nodes.userInput.disabled) return;
                this._addMessageToLog(message, 'user');
                this.nodes.userInput.value = '';
                this._setChatInputDisabled(true);
                try {
                    await this._handleMessage(message); 
                } catch (error) {
                    console.error("Erro no fluxo principal da mensagem do Jarvis:", error);
                    this._addMessageToLog("Desculpe, Senhor. Ocorreu um erro interno. Por favor, tente novamente.", 'jarvis');
                } finally {
                    this._setChatInputDisabled(false);
                }
            },

            async _handleMessage(message) {
                if(!this.state.session) this._initSession();
                this.state.session.history.push({ role: "user", parts: [{ text: message }] });

                let shouldContinue = true;
                while(shouldContinue) {
                    shouldContinue = false;
                    this._addTypingIndicator();
                    
                    let apiResponse;
                    try {
                        apiResponse = await this._callGeminiAPI(this.state.session.history);
                    } finally {
                        this._removeTypingIndicator();
                    }

                    if (apiResponse.error) { this._addMessageToLog(apiResponse.error, 'jarvis'); return; }
                    if (!apiResponse.candidates?.length) { this._addMessageToLog("Desculpe, não consegui processar sua solicitação.", 'jarvis'); return; }

                    const responseContent = apiResponse.candidates[0].content;
                    this.state.session.history.push(responseContent);

                    let functionCallPart = null;
                    for (const part of responseContent.parts) {
                        if (part.text) {
                            this._addMessageToLog(part.text, 'jarvis');
                        } else if (part.functionCall) {
                            functionCallPart = part.functionCall;
                        }
                    }

                    if (functionCallPart) {
                        const functionName = functionCallPart.name;
                        const functionArgs = functionCallPart.args;
                        let toolResult = {};
                        try {
                            if (this.knowledge.toolFunctions[functionName]) {
                                // CORRIGIDO: Chamamos a função usando .call() para passar o contexto do App.
                                // Isso garante que `this.knowledge.plans` estará disponível dentro da função da ferramenta.
                                toolResult = await this.knowledge.toolFunctions[functionName].call(this.parent, functionArgs);
                            } else {
                                toolResult = { error: `Ferramenta ${functionName} não encontrada.` };
                            }
                        } catch (error) {
                             console.error(`Erro ao executar a ferramenta Jarvis '${functionName}':`, error);
                             toolResult = { error: `Ocorreu um erro interno ao usar a ferramenta ${functionName}.` };
                        }
                        
                        this.state.session.history.push({ 
                            role: "tool", 
                            parts: [{ functionResponse: { name: functionName, response: toolResult } }] 
                        });
                        shouldContinue = true;
                    }
                }
            },

            async _callGeminiAPI(history) {
                // Acessa a config através do `this.parent` (que é o App)
                if (!this.parent.config.geminiApiKey.startsWith("AIza")) {
                     console.error("Chave de API do Gemini inválida ou não configurada para o Jarvis.");
                     return { error: "A conexão com a IA não foi configurada corretamente." };
                }
                const apiUrl = `${this.parent.config.geminiApiUrl}${this.parent.config.geminiApiKey}`;
                const payload = { contents: history, tools: this.knowledge.tools };
                try {
                    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!response.ok) {
                         const errorText = await response.text();
                         console.error("Gemini API error response:", errorText);
                         throw new Error(`API Error: ${response.status}`);
                    }
                    return await response.json();
                } catch (error) {
                    console.error("Gemini API call failed:", error);
                    return { error: "Não foi possível conectar à IA. Tente novamente mais tarde." };
                }
            },

            _initSession() {
                if (!this.state.session) {
                    this.state.session = {
                        history: [
                            { role: "user", parts: [{ text: this.parent.jarvis.knowledge.systemPrompt }] },
                            { role: "model", parts: [{ text: "Olá! Eu sou o Jarvis, assistente virtual da Piel Telecom, um agente autorizado Desktop. Para que eu possa encontrar o plano de internet ideal para o Senhor, poderia me dizer qual será o principal uso da sua internet?" }] }
                        ]
                    };
                    // CORREÇÃO: Exibe a primeira mensagem do Jarvis sem usar "números mágicos"
                    this._addMessageToLog(this.state.session.history[1].parts[0].text, 'jarvis');
                }
            },
            
            _addMessageToLog(message, sender) { if (!this.nodes.chatLog) return; const messageContainer = document.createElement('div'); messageContainer.className = sender === 'user' ? 'user-message' : 'jarvis-message'; const bubble = document.createElement('div'); bubble.className = 'message-bubble'; bubble.innerHTML = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'); messageContainer.appendChild(bubble); this.nodes.chatLog.appendChild(messageContainer); this.nodes.chatLog.scrollTop = this.nodes.chatLog.scrollHeight; },
            _addTypingIndicator() { if(document.getElementById('typing-indicator-bubble')) return; const indicator = document.createElement('div'); indicator.id = 'typing-indicator-bubble'; indicator.className = 'jarvis-message'; indicator.innerHTML = `<div class="message-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`; this.nodes.chatLog.appendChild(indicator); this.nodes.chatLog.scrollTop = this.nodes.chatLog.scrollHeight; },
            _removeTypingIndicator() { document.getElementById('typing-indicator-bubble')?.remove(); },
            _setChatInputDisabled(isDisabled) { if (this.nodes.userInput) this.nodes.userInput.disabled = isDisabled; if (this.nodes.sendButton) this.nodes.sendButton.disabled = isDisabled; if (!isDisabled && this.state.isOpen) this.nodes.userInput.focus(); },
            
            knowledge: {
                systemPrompt: `System instruction: [COLE SEU PROMPT COMPLETO DO JARVIS AQUI, POIS ELE É MUITO LONGO PARA INCLUIR NESTA RESPOSTA]`,
                tools: [{
                    functionDeclarations: [
                        { name: "start_customer_registration", description: "Inicia o processo de cadastro do cliente após ele ter fornecido todos os dados necessários e confirmado o plano.", parameters: { type: "OBJECT", properties: { plano: { type: "STRING" }, nome_completo: { type: "STRING" }, nome_mae: { type: "STRING" }, data_nascimento: { type: "STRING" }, cpf: { type: "STRING" }, rg: { type: "STRING" }, email: { type: "STRING" }, rua_numero: { type: "STRING" }, bairro: { type: "STRING" }, cidade: { type: "STRING" }, cep: { type: "STRING" }, periodo_instalacao: { type: "STRING" } }, required: ["plano", "nome_completo", "nome_mae", "data_nascimento", "cpf", "rg", "email", "rua_numero", "bairro", "cidade", "cep", "periodo_instalacao"] } },
                        { name: "validate_cpf", description: "Valida um número de CPF para verificar se é um documento matematicamente válido.", parameters: { type: "OBJECT", properties: { cpf: { type: "STRING" } }, required: ["cpf"] } },
                        { name: "validate_rg", description: "Valida um número de RG para verificar se tem um formato plausível (apenas contagem de dígitos).", parameters: { type: "OBJECT", properties: { rg: { type: "STRING" } }, required: ["rg"] } },
                        { name: "get_plan_details", description: "Busca e retorna os detalhes de todos os planos de internet que contenham o termo pesquisado. Útil para perguntas como 'quais os planos de 1 giga?'.", parameters: { type: "OBJECT", properties: { termo_de_busca: { type: "STRING", description: "O termo para buscar nos nomes dos planos, ex: '600M' ou 'Gamer'" } }, required: ["termo_de_busca"] } }
                    ]
                }],
                toolFunctions: {
                    validate_cpf: async ({ cpf }) => { cpf = cpf.replace(/[^\d]+/g, ''); if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return { "isValid": false }; let sum = 0, remainder; for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i); remainder = (sum * 10) % 11; if ((remainder === 10) || (remainder === 11)) remainder = 0; if (remainder !== parseInt(cpf.substring(9, 10))) return { "isValid": false }; sum = 0; for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i); remainder = (sum * 10) % 11; if ((remainder === 10) || (remainder === 11)) remainder = 0; if (remainder !== parseInt(cpf.substring(10, 11))) return { "isValid": false }; return { "isValid": true }; },
                    validate_rg: async ({ rg }) => {
                        const cleanedRg = typeof rg === 'string' ? rg.replace(/[^\dX]+/gi, '') : '';
                        return { isValid: cleanedRg.length >= 7 && cleanedRg.length <= 10 };
                    },
                    /**
                     * MELHORIA: A função agora busca em todos os planos e retorna uma lista de correspondências.
                     * @param {object} args - Argumentos da função, ex: { termo_de_busca: '600M' }.
                     * @returns {Promise<object>}
                     */
                    get_plan_details: async function({ termo_de_busca }) {
                        // `this` aqui se refere ao objeto `App` graças ao .call()
                        const allPlans = Object.values(this.knowledge.plans);
                        const searchResults = allPlans.filter(plan =>
                            plan.nome.toLowerCase().includes(termo_de_busca.toLowerCase())
                        );
                        if (searchResults.length > 0) {
                            return { success: true, plans_found: searchResults };
                        }
                        return { success: false, message: "Nenhum plano encontrado para: " + termo_de_busca };
                    },
                    start_customer_registration: async (data) => { 
                        console.log("REGISTRATION DATA TO BE SENT TO CRM:", data); 
                        return { success: true, message: "Cadastro recebido. Um consultor humano irá revisar e confirmar os detalhes." }; 
                    }
                }
            }
        },
    }
    // Inicia a aplicação.
    App.init();
});