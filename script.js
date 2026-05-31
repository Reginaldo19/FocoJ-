// ==================== CONFIGURAÇÃO DO FIREBASE ====================

const firebaseConfig = {
    apiKey: "AIzaSyACIj5d-Nf01jF4AbzPfXOLNzQpyRXy4Qo",
    authDomain: "afrimov-c6484.firebaseapp.com",
    databaseURL: "https://afrimov-c6484-default-rtdb.firebaseio.com",
    projectId: "afrimov-c6484",
    storageBucket: "afrimov-c6484.firebasestorage.app",
    messagingSenderId: "614232050013",
    appId: "1:614232050013:web:ad3fdf1dbe8187a329c0b4"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

// ==================== VARIÁVEIS GLOBAIS ====================

let currentUser = null;
let currentUserData = null;
let currentUserType = null;
let activeNav = 'dashboard';
let allStorys = [];
let allPublicacoes = [];
let allEmpresas = [];
let allMeusPedidos = [];
let seguindoIds = [];
let seguidoresIds = [];
let currentChatId = null;
let currentChatType = null;
let currentChatNome = null;
let currentChatDestinatarioId = null;
let currentGrupoId = null;
let currentChatMessagesRef = null;
let currentGrupoMessagesRef = null;
let unreadChatsCount = 0;
let storysListener = null;
let publicacoesListener = null;
let currentProfileTab = 'pedidos';
let carrinho = [];
let cupomAplicado = null;
let storyTimer = null;
let currentStoryIndex = 0;
let currentStoryList = [];
let currentStoryEmpresaId = null;

// ==================== FUNÇÕES AUXILIARES ====================

function showToast(msg, type = 'success') {
    Toastify({
        text: msg,
        duration: 3000,
        gravity: "top",
        position: "right",
        style: { background: type === 'error' ? '#DC2626' : '#10B981' }
    }).showToast();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatNumber(num) {
    if (!num && num !== 0) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Agora';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'min';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function getUserName(uid) {
    if (!uid) return 'Usuário';
    if (uid === 'system') return 'Sistema';

    const empresaSnap = await db.ref(`empresas/${uid}`).once('value');
    if (empresaSnap.exists()) return empresaSnap.val().nomeEmpresa;

    const clienteSnap = await db.ref(`clientes/${uid}`).once('value');
    if (clienteSnap.exists()) return clienteSnap.val().nome;

    return uid.substring(0, 8);
}

async function sendSystemMessage(grupoId, texto) {
    const messagesRef = db.ref(`gruposMensagens/${grupoId}`);
    await messagesRef.push({
        texto: texto,
        de: 'system',
        data: Date.now(),
        isSystem: true
    });
}

function getStatusText(status) {
    const texts = {
        'pendente': 'Pendente',
        'confirmado': 'Confirmado',
        'preparando': 'Preparando',
        'enviado': 'Enviado',
        'entregue': 'Entregue',
        'rejeitado': 'Rejeitado',
        'cancelado': 'Cancelado'
    };
    return texts[status] || 'Pendente';
}

function getStatusClass(status) {
    const classes = {
        'pendente': 'status-pendente',
        'confirmado': 'status-confirmado',
        'preparando': 'status-preparando',
        'enviado': 'status-enviado',
        'entregue': 'status-entregue',
        'rejeitado': 'status-rejeitado',
        'cancelado': 'status-cancelado'
    };
    return classes[status] || 'status-pendente';
}

// ==================== CARRINHO ====================

function carregarCarrinho() {
    const saved = localStorage.getItem('carrinho');
    if (saved) carrinho = JSON.parse(saved);
    const savedCupom = localStorage.getItem('cupomAplicado');
    if (savedCupom && savedCupom !== 'null') cupomAplicado = JSON.parse(savedCupom);
    atualizarCarrinhoBadge();
}

function salvarCarrinho() {
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
    localStorage.setItem('cupomAplicado', JSON.stringify(cupomAplicado));
    atualizarCarrinhoBadge();
}

function atualizarCarrinhoBadge() {
    const badges = document.querySelectorAll('#carrinhoBadge, #carrinhoBadgeMobile');
    const totalItens = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
    badges.forEach(badge => {
        if (badge) {
            if (totalItens > 0) {
                badge.style.display = 'flex';
                badge.innerText = totalItens > 9 ? '9+' : totalItens;
            } else {
                badge.style.display = 'none';
            }
        }
    });
}

function adicionarAoCarrinho(pub) {
    if (!pub) {
        showToast('Erro ao adicionar produto', 'error');
        return;
    }
    
    const existingItem = carrinho.find(item => item.id === pub.id);
    if (existingItem) {
        existingItem.quantidade++;
        showToast(`${pub.titulo} quantidade aumentada para ${existingItem.quantidade}!`);
    } else {
        carrinho.push({
            id: pub.id,
            titulo: pub.titulo,
            preco: pub.preco,
            imagem: pub.imagens?.[0] || null,
            empresaId: pub.empresaId,
            empresaNome: pub.empresaNome,
            quantidade: 1
        });
        showToast(`${pub.titulo} adicionado ao carrinho!`);
    }
    salvarCarrinho();
}

function removerItemCarrinho(itemId) {
    carrinho = carrinho.filter(item => item.id !== itemId);
    salvarCarrinho();
    renderCarrinho();
    showToast('Item removido do carrinho');
}

function atualizarQuantidadeItem(itemId, delta) {
    const item = carrinho.find(i => i.id === itemId);
    if (item) {
        item.quantidade += delta;
        if (item.quantidade <= 0) {
            carrinho = carrinho.filter(i => i.id !== itemId);
        }
        salvarCarrinho();
        renderCarrinho();
    }
}

function limparCarrinho() {
    carrinho = [];
    cupomAplicado = null;
    salvarCarrinho();
    renderCarrinho();
    showToast('Carrinho limpo');
}

async function aplicarCupom(codigo, totalCompra) {
    // Buscar cupom apenas da empresa que está no carrinho
    // O cupom só pode ser usado se for da mesma empresa dos produtos no carrinho
    const empresasNoCarrinho = new Set();
    for (const item of carrinho) {
        empresasNoCarrinho.add(item.empresaId);
    }
    
    // Se tiver produtos de mais de uma empresa, não permite cupom
    if (empresasNoCarrinho.size > 1) {
        showToast('Cupom só pode ser aplicado quando o carrinho tem produtos de uma única empresa', 'error');
        return null;
    }
    
    const empresaId = Array.from(empresasNoCarrinho)[0];
    
    const cuponsSnap = await db.ref(`cupons/${empresaId}`).once('value');
    let cupomEncontrado = null;
    
    for (const [cupomId, cupom] of Object.entries(cuponsSnap.val() || {})) {
        if (cupom.codigo === codigo.toUpperCase() && cupom.ativo !== false) {
            if (cupom.validade && cupom.validade < Date.now()) {
                showToast('Cupom expirado!', 'error');
                return null;
            }
            
            if (cupom.limiteTotal !== -1 && cupom.usadoTotal >= cupom.limiteTotal) {
                showToast('Cupom já atingiu o limite de uso!', 'error');
                return null;
            }
            
            if (cupom.limitePorUsuario !== -1 && cupom.usadosPor && cupom.usadosPor[currentUser.uid]) {
                showToast('Você já usou este cupom!', 'error');
                return null;
            }
            
            if (cupom.valorMinimo && totalCompra < cupom.valorMinimo) {
                showToast(`Valor mínimo para este cupom é ${formatNumber(cupom.valorMinimo)} KZ`, 'error');
                return null;
            }
            
            cupomEncontrado = { ...cupom, id: cupomId };
            break;
        }
    }
    
    if (!cupomEncontrado) {
        showToast('Cupom inválido!', 'error');
        return null;
    }
    
    let desconto = 0;
    if (cupomEncontrado.tipo === 'percentual') {
        desconto = (totalCompra * cupomEncontrado.valor) / 100;
    } else {
        desconto = cupomEncontrado.valor;
    }
    
    if (desconto > totalCompra) desconto = totalCompra;
    
    return {
        ...cupomEncontrado,
        empresaId: empresaId,
        desconto: desconto,
        valorFinal: totalCompra - desconto
    };
}

async function registrarUsoCupom(cupom, pedidoId) {
    if (!cupom || !cupom.empresaId) return;
    
    const cupomRef = db.ref(`cupons/${cupom.empresaId}/${cupom.id}`);
    const updates = {
        usadoTotal: (cupom.usadoTotal || 0) + 1,
        [`usadosPor/${currentUser.uid}`]: {
            data: Date.now(),
            pedidoId: pedidoId,
            valor: cupom.desconto
        }
    };
    
    await cupomRef.update(updates);
}

async function finalizarPedido(endereco) {
    if (carrinho.length === 0) {
        showToast('Carrinho vazio', 'error');
        return;
    }
    
    if (!endereco) {
        showToast('Informe o endereço de entrega', 'error');
        return;
    }
    
    const pedidoRef = db.ref('pedidos').push();
    
    let total = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    let desconto = 0;
    
    if (cupomAplicado && cupomAplicado.valido) {
        desconto = cupomAplicado.desconto;
        total = cupomAplicado.valorFinal;
    }
    
    const pedido = {
        id: pedidoRef.key,
        clienteId: currentUser.uid,
        clienteNome: currentUserData?.nome || currentUser.displayName || 'Cliente',
        itens: carrinho.map(item => ({
            id: item.id,
            titulo: item.titulo,
            preco: item.preco,
            quantidade: item.quantidade,
            empresaId: item.empresaId,
            empresaNome: item.empresaNome,
            imagem: item.imagem
        })),
        subtotal: carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0),
        desconto: desconto,
        total: total,
        status: 'pendente',
        data: Date.now(),
        endereco: endereco,
        cupomUsado: cupomAplicado ? {
            codigo: cupomAplicado.codigo,
            nome: cupomAplicado.nome,
            desconto: desconto
        } : null
    };
    
    await pedidoRef.set(pedido);
    
    if (cupomAplicado && cupomAplicado.valido) {
        await registrarUsoCupom(cupomAplicado, pedidoRef.key);
    }
    
    const empresasNotificadas = new Set();
    for (const item of carrinho) {
        if (!empresasNotificadas.has(item.empresaId)) {
            empresasNotificadas.add(item.empresaId);
            const notifRef = db.ref(`notificacoes/${item.empresaId}`).push();
            await notifRef.set({
                tipo: 'novo_pedido',
                pedidoId: pedidoRef.key,
                clienteNome: pedido.clienteNome,
                mensagem: `🛒 Novo pedido de ${pedido.clienteNome} - Total: ${formatNumber(pedido.total)} KZ`,
                data: Date.now(),
                lida: false
            });
        }
    }
    
    // Adicionar pontos de fidelidade
    await addLoyaltyPoints(Math.floor(total / 100), `Compra realizada - Pedido #${pedidoRef.key.substring(0, 8)}`);
    
    carrinho = [];
    cupomAplicado = null;
    salvarCarrinho();
    
    showToast('Pedido realizado com sucesso!');
    
    // Recarregar pedidos
    await carregarMeusPedidos();
    
    if (activeNav === 'carrinho') setActiveNav('dashboard');
}

async function renderCarrinho() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    
    if (carrinho.length === 0) {
        cupomAplicado = null;
        main.innerHTML = `
            <div class="header">
                <h2><i class="fas fa-shopping-cart" style="color: #D4AF37;"></i> Meu Carrinho</h2>
            </div>
            <div class="empty-state">
                <i class="fas fa-shopping-cart fa-3x mb-3"></i>
                <p>Seu carrinho está vazio</p>
                <p class="small">Explore o feed e adicione produtos ao carrinho!</p>
                <button class="btn-primary-custom mt-3" onclick="setActiveNav('feed')" style="width: auto; padding: 10px 30px;">
                    <i class="fas fa-fire me-2"></i>Explorar
                </button>
            </div>
        `;
        return;
    }
    
    let subtotal = 0;
    let html = `
        <div class="header">
            <h2><i class="fas fa-shopping-cart" style="color: #D4AF37;"></i> Meu Carrinho (${carrinho.length} itens)</h2>
            <button id="limparCarrinhoBtn" style="background: #DC2626; border: none; border-radius: 20px; padding: 8px 16px; color: white; font-size: 12px; cursor: pointer;">
                <i class="fas fa-trash"></i> Limpar
            </button>
        </div>
    `;
    
    const empresasNoCarrinho = {};
    for (const item of carrinho) {
        if (!empresasNoCarrinho[item.empresaId]) {
            empresasNoCarrinho[item.empresaId] = {
                nome: item.empresaNome,
                itens: []
            };
        }
        empresasNoCarrinho[item.empresaId].itens.push(item);
    }
    
    for (const [empresaId, empresa] of Object.entries(empresasNoCarrinho)) {
        let empresaSubtotal = 0;
        html += `<div class="mb-3"><div class="fw-bold mb-2"><i class="fas fa-store"></i> ${escapeHtml(empresa.nome)}</div>`;
        
        for (const item of empresa.itens) {
            const subtotalItem = item.preco * item.quantidade;
            empresaSubtotal += subtotalItem;
            subtotal += subtotalItem;
            
            html += `
                <div class="carrinho-item" style="display: flex; gap: 12px; background: white; border-radius: 16px; padding: 12px; margin-bottom: 10px; border: 1px solid #E2E8F0;">
                    ${item.imagem ? `<img src="${item.imagem}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 12px;">` : `<div style="width: 70px; height: 70px; background: #F1F5F9; border-radius: 12px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-image text-muted fa-2x"></i></div>`}
                    <div style="flex: 1;">
                        <div class="fw-bold">${escapeHtml(item.titulo)}</div>
                        <div class="text-warning fw-bold">${formatNumber(item.preco)} KZ</div>
                        <div class="d-flex align-items-center gap-2 mt-2">
                            <button class="btn-qtd" data-id="${item.id}" data-delta="-1" style="background: #E2E8F0; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer;">-</button>
                            <span class="fw-bold">${item.quantidade}</span>
                            <button class="btn-qtd" data-id="${item.id}" data-delta="1" style="background: #E2E8F0; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer;">+</button>
                            <button class="btn-remover-item" data-id="${item.id}" style="background: none; border: none; color: #DC2626; margin-left: 8px; cursor: pointer;"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="fw-bold">${formatNumber(subtotalItem)} KZ</div>
                </div>
            `;
        }
        
        html += `<div class="text-end fw-bold mb-3">Subtotal: ${formatNumber(empresaSubtotal)} KZ</div></div><hr>`;
    }
    
    let total = subtotal;
    let descontoHtml = '';
    
    if (cupomAplicado && cupomAplicado.valido) {
        total = cupomAplicado.valorFinal;
        descontoHtml = `
            <div class="d-flex justify-content-between mb-2">
                <span>Desconto (${cupomAplicado.codigo}):</span>
                <span class="text-success">- ${formatNumber(cupomAplicado.desconto)} KZ</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
                <button id="removerCupomBtn" class="btn btn-sm btn-outline-danger" style="font-size: 11px; padding: 4px 12px; border-radius: 20px;">
                    <i class="fas fa-times"></i> Remover cupom
                </button>
            </div>
        `;
    }
    
    html += `
        <div class="carrinho-resumo" style="background: white; border-radius: 20px; padding: 20px; margin-top: 16px;">
            <div class="d-flex justify-content-between mb-2">
                <span>Subtotal:</span>
                <span class="fw-bold">${formatNumber(subtotal)} KZ</span>
            </div>
            ${descontoHtml}
            <div class="d-flex justify-content-between mb-3 pt-2 border-top">
                <span class="fw-bold fs-5">Total:</span>
                <span class="fw-bold fs-4 text-warning">${formatNumber(total)} KZ</span>
            </div>
            
            <div class="mb-3">
                <div class="input-group">
                    <input type="text" id="cupomInput" class="form-control" placeholder="Código do cupom" value="${cupomAplicado ? cupomAplicado.codigo : ''}">
                    <button id="aplicarCupomBtn" class="btn-primary-custom" style="width: auto; padding: 0 20px;">Aplicar</button>
                </div>
            </div>
            
            <textarea id="enderecoEntrega" class="form-control mb-2" placeholder="Endereço de entrega *" rows="2"></textarea>
            <button id="finalizarPedidoBtn" class="btn-primary-custom">Finalizar Pedido</button>
        </div>
    `;
    
    main.innerHTML = html;
    
    document.querySelectorAll('.btn-qtd').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const delta = parseInt(btn.dataset.delta);
            atualizarQuantidadeItem(id, delta);
        });
    });
    
    document.querySelectorAll('.btn-remover-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            removerItemCarrinho(id);
        });
    });
    
    document.getElementById('limparCarrinhoBtn')?.addEventListener('click', async () => {
        const result = await Swal.fire({
            title: 'Limpar carrinho?',
            text: 'Todos os itens serão removidos',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#DC2626',
            confirmButtonText: 'Sim, limpar'
        });
        if (result.isConfirmed) {
            limparCarrinho();
        }
    });
    
    document.getElementById('aplicarCupomBtn')?.addEventListener('click', async () => {
        const codigo = document.getElementById('cupomInput').value.trim();
        if (!codigo) {
            showToast('Digite o código do cupom', 'error');
            return;
        }
        
        const resultado = await aplicarCupom(codigo, subtotal);
        if (resultado) {
            cupomAplicado = { ...resultado, valido: true };
            salvarCarrinho();
            showToast(`Cupom aplicado! Você economizou ${formatNumber(resultado.desconto)} KZ`, 'success');
            renderCarrinho();
        }
    });
    
    document.getElementById('removerCupomBtn')?.addEventListener('click', () => {
        cupomAplicado = null;
        salvarCarrinho();
        renderCarrinho();
    });
    
    document.getElementById('finalizarPedidoBtn')?.addEventListener('click', async () => {
        const endereco = document.getElementById('enderecoEntrega').value.trim();
        await finalizarPedido(endereco);
    });
}

// ==================== CARREGAR MEUS PEDIDOS ====================

async function carregarMeusPedidos() {
    try {
        const pedidosSnap = await db.ref('pedidos').orderByChild('clienteId').equalTo(currentUser.uid).once('value');
        const pedidos = [];
        pedidosSnap.forEach(child => {
            if (child.val()) {
                pedidos.push({ id: child.key, ...child.val() });
            }
        });
        pedidos.sort((a, b) => b.data - a.data);
        allMeusPedidos = pedidos;
        return pedidos;
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        return [];
    }
}

// ==================== PEDIDOS ====================

async function atualizarStatusPedido(pedidoId, novoStatus, motivoRejeicao = null) {
    const pedidoRef = db.ref(`pedidos/${pedidoId}`);
    const pedidoSnap = await pedidoRef.once('value');
    const pedido = pedidoSnap.val();
    
    if (!pedido) return;
    
    await pedidoRef.update({ 
        status: novoStatus,
        ultimaAtualizacao: Date.now(),
        motivoRejeicao: motivoRejeicao
    });
    
    const notifClienteRef = db.ref(`notificacoes/${pedido.clienteId}`).push();
    let mensagem = '';
    
    switch(novoStatus) {
        case 'confirmado':
            mensagem = `✅ Seu pedido #${pedidoId.substring(0,8)} foi confirmado!`;
            break;
        case 'preparando':
            mensagem = `🍳 Seu pedido #${pedidoId.substring(0,8)} está sendo preparado!`;
            break;
        case 'enviado':
            mensagem = `🚚 Seu pedido #${pedidoId.substring(0,8)} foi enviado!`;
            break;
        case 'entregue':
            mensagem = `🎉 Seu pedido #${pedidoId.substring(0,8)} foi entregue!`;
            await addLoyaltyPoints(Math.floor(pedido.total / 50), `Pedido entregue #${pedidoId.substring(0, 8)}`);
            break;
        case 'rejeitado':
            mensagem = `❌ Seu pedido #${pedidoId.substring(0,8)} foi rejeitado. Motivo: ${motivoRejeicao || 'Não informado'}`;
            break;
    }
    
    await notifClienteRef.set({
        tipo: 'pedido_atualizado',
        pedidoId: pedidoId,
        status: novoStatus,
        mensagem: mensagem,
        data: Date.now(),
        lida: false
    });
    
    showToast(`Pedido ${getStatusText(novoStatus)}!`);
    
    await carregarMeusPedidos();
    
    if (activeNav === 'dashboard') renderDashboard();
    if (activeNav === 'perfil') renderPerfil();
    if (activeNav === 'pedidos') renderMeusPedidosPage();
}

async function renderMeusPedidosPage() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    
    await carregarMeusPedidos();
    
    main.innerHTML = `
        <div class="header">
            <h2><i class="fas fa-box" style="color: #D4AF37;"></i> Meus Pedidos</h2>
        </div>
        <div id="pedidosContainer"></div>
    `;
    
    const container = document.getElementById('pedidosContainer');
    
    if (allMeusPedidos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open fa-3x mb-3"></i>
                <p>Você ainda não fez nenhum pedido</p>
                <p class="small">Explore o feed e compre produtos para aparecerem aqui!</p>
                <button class="btn-primary-custom mt-3" onclick="setActiveNav('feed')" style="width: auto; padding: 10px 24px;">
                    <i class="fas fa-fire me-2"></i>Explorar Feed
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    for (const pedido of allMeusPedidos) {
        const statusClass = getStatusClass(pedido.status);
        
        html += `
            <div class="pedido-card">
                <div class="pedido-header">
                    <div>
                        <span class="fw-bold">Pedido #${pedido.id.substring(0, 8)}</span>
                        <span class="status-pedido ${statusClass} ms-2">${getStatusText(pedido.status)}</span>
                    </div>
                    <div class="small text-muted">${new Date(pedido.data).toLocaleString()}</div>
                </div>
                
                <div class="mb-3">
                    <strong>Itens do pedido:</strong>
                    <div class="mt-2">
                        ${pedido.itens.map(item => `
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div class="d-flex align-items-center gap-2">
                                    ${item.imagem ? `<img src="${item.imagem}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">` : ''}
                                    <span>${item.quantidade}x ${escapeHtml(item.titulo)}</span>
                                </div>
                                <span class="text-warning fw-bold">${formatNumber(item.preco * item.quantidade)} KZ</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="border-top pt-3">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                            <div class="small text-muted">📦 Entrega: ${pedido.endereco || 'Não informado'}</div>
                            ${pedido.cupomUsado ? `<div class="small text-success mt-1">🎫 Cupom: ${pedido.cupomUsado.codigo} (${formatNumber(pedido.desconto)} KZ off)</div>` : ''}
                            ${pedido.status === 'rejeitado' && pedido.motivoRejeicao ? `<div class="small text-danger mt-1">❌ Motivo: ${pedido.motivoRejeicao}</div>` : ''}
                        </div>
                        <div class="fw-bold fs-4 text-warning">${formatNumber(pedido.total)} KZ</div>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ==================== CUPONS (APENAS PARA EMPRESAS) ====================

async function openCuponsScreen() {
    if (currentUserType !== 'empresa') {
        showToast('Apenas empresas podem gerenciar cupons', 'error');
        return;
    }
    
    const screen = document.getElementById('cuponsScreen');
    const container = document.getElementById('cuponsList');
    
    if (!screen || !container) return;
    
    screen.style.display = 'flex';
    
    try {
        const cuponsSnap = await db.ref(`cupons/${currentUser.uid}`).once('value');
        const cupons = [];
        cuponsSnap.forEach(child => cupons.push({ id: child.key, ...child.val() }));
        
        cupons.sort((a, b) => b.dataCriacao - a.dataCriacao);
        
        if (cupons.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-ticket-alt fa-3x mb-3"></i>
                    <p>Nenhum cupom criado</p>
                    <p class="small">Clique no + para criar um cupom de desconto</p>
                </div>
            `;
        } else {
            let html = '';
            for (const cupom of cupons) {
                const expirado = cupom.validade && cupom.validade < Date.now();
                const atingiuLimite = cupom.limiteTotal !== -1 && cupom.usadoTotal >= cupom.limiteTotal;
                const ativo = !expirado && !atingiuLimite && cupom.ativo !== false;
                
                html += `
                    <div class="cupom-card" style="${!ativo ? 'opacity: 0.6;' : ''}">
                        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                            <div>
                                <h5 class="fw-bold mb-1">${escapeHtml(cupom.nome)}</h5>
                                <div class="cupom-codigo">
                                    📋 ${cupom.codigo}
                                </div>
                            </div>
                            <span class="badge-gold" style="font-size: 14px;">
                                ${cupom.tipo === 'percentual' ? cupom.valor + '% OFF' : formatNumber(cupom.valor) + ' KZ OFF'}
                            </span>
                        </div>
                        <div class="small mb-3" style="color: #64748B;">
                            ${cupom.valorMinimo > 0 ? `<div>💰 Mínimo: ${formatNumber(cupom.valorMinimo)} KZ</div>` : '<div>💰 Sem valor mínimo</div>'}
                            ${cupom.validade ? `<div>📅 Válido até: ${new Date(cupom.validade).toLocaleDateString()}</div>` : '<div>📅 Sem validade</div>'}
                            <div>🎯 Usado: ${cupom.usadoTotal || 0} vez(es)</div>
                            <div>🏷️ Tipo: ${cupom.tipo === 'percentual' ? 'Percentual' : 'Valor fixo'}</div>
                        </div>
                        <div class="d-flex justify-content-end gap-2">
                            <button class="btn-excluir-cupom btn-sm" data-id="${cupom.id}" style="background: #DC2626; border: none; color: white; cursor: pointer; padding: 6px 16px; border-radius: 20px;">
                                <i class="fas fa-trash"></i> Excluir
                            </button>
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html;
            
            document.querySelectorAll('.btn-excluir-cupom').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const result = await Swal.fire({
                        title: 'Excluir cupom?',
                        text: 'Esta ação não pode ser desfeita',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#DC2626',
                        confirmButtonText: 'Sim, excluir'
                    });
                    if (result.isConfirmed) {
                        await db.ref(`cupons/${currentUser.uid}/${btn.dataset.id}`).remove();
                        showToast('Cupom removido');
                        openCuponsScreen();
                    }
                });
            });
        }
    } catch (error) {
        console.error('Erro ao carregar cupons:', error);
        container.innerHTML = '<div class="empty-state"><p class="text-danger">Erro ao carregar cupons</p></div>';
    }
}

async function showNovoCupomModal() {
    if (currentUserType !== 'empresa') {
        showToast('Apenas empresas podem criar cupons', 'error');
        return;
    }
    
    const { value: formValues } = await Swal.fire({
        title: '🎫 Criar Cupom de Desconto',
        html: `
            <div style="text-align: left;">
                <label style="font-size: 13px; font-weight: 600;">Nome do cupom *</label>
                <input id="cupomNome" class="swal2-input" placeholder="Ex: Black Friday" style="margin-bottom: 15px;">
                
                <label style="font-size: 13px; font-weight: 600;">Código</label>
                <input id="cupomCodigo" class="swal2-input" placeholder="Deixe em branco para gerar automaticamente" style="margin-bottom: 15px;">
                
                <label style="font-size: 13px; font-weight: 600;">Tipo de desconto *</label>
                <select id="cupomTipo" class="swal2-select" style="margin-bottom: 15px;">
                    <option value="percentual">Percentual (%)</option>
                    <option value="fixo">Valor Fixo (KZ)</option>
                </select>
                
                <label style="font-size: 13px; font-weight: 600;">Valor do desconto *</label>
                <input id="cupomValor" class="swal2-input" type="number" placeholder="Digite o valor" style="margin-bottom: 15px;">
                
                <label style="font-size: 13px; font-weight: 600;">Data de validade</label>
                <input id="cupomValidade" class="swal2-input" type="date" style="margin-bottom: 15px;">
                
                <label style="font-size: 13px; font-weight: 600;">Valor mínimo da compra</label>
                <input id="cupomMinimo" class="swal2-input" type="number" placeholder="0 = sem valor mínimo" style="margin-bottom: 15px;">
                
                <label style="font-size: 13px; font-weight: 600;">Limite de uso total</label>
                <input id="cupomLimite" class="swal2-input" type="number" placeholder="-1 = ilimitado" style="margin-bottom: 15px;">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Criar Cupom',
        confirmButtonColor: '#0A2647',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const nome = document.getElementById('cupomNome').value.trim();
            let codigo = document.getElementById('cupomCodigo').value.trim().toUpperCase();
            const tipo = document.getElementById('cupomTipo').value;
            const valor = parseFloat(document.getElementById('cupomValor').value);
            
            if (!nome || !valor) {
                Swal.showValidationMessage('Preencha nome e valor do desconto');
                return false;
            }
            if (valor <= 0) {
                Swal.showValidationMessage('Valor do desconto deve ser maior que zero');
                return false;
            }
            if (!codigo) {
                codigo = nome.toUpperCase().replace(/[^A-Z0-9]/g, '') + Math.floor(Math.random() * 1000);
            }
            
            const validade = document.getElementById('cupomValidade').value;
            const minimo = parseFloat(document.getElementById('cupomMinimo').value) || 0;
            const limiteTotal = parseInt(document.getElementById('cupomLimite').value) || -1;
            
            return { nome, codigo, tipo, valor, validade: validade ? new Date(validade).getTime() : null, minimo, limiteTotal };
        }
    });
    
    if (formValues) {
        await db.ref(`cupons/${currentUser.uid}`).push().set({
            nome: formValues.nome,
            codigo: formValues.codigo,
            tipo: formValues.tipo,
            valor: formValues.valor,
            validade: formValues.validade,
            valorMinimo: formValues.minimo,
            usadoTotal: 0,
            usadosPor: {},
            dataCriacao: Date.now(),
            ativo: true,
            limiteTotal: formValues.limiteTotal,
            limitePorUsuario: -1
        });
        showToast(`✅ Cupom "${formValues.nome}" criado com sucesso!`);
        openCuponsScreen();
    }
}

// ==================== FIDELIDADE ====================

async function getLoyaltyInfo() {
    try {
        const loyaltySnap = await db.ref(`fidelidade/${currentUser.uid}`).once('value');
        let loyalty = loyaltySnap.val();

        if (!loyalty) {
            loyalty = { 
                pontos: 0, 
                nivel: 'Bronze', 
                historico: [],
                dataAtualizacao: Date.now()
            };
            await db.ref(`fidelidade/${currentUser.uid}`).set(loyalty);
        }
        
        // Garantir que historico existe
        if (!loyalty.historico) {
            loyalty.historico = [];
            await db.ref(`fidelidade/${currentUser.uid}`).update({ historico: [] });
        }
        
        let nivelCorreto = 'Bronze';
        if (loyalty.pontos >= 1000) nivelCorreto = 'Ouro';
        else if (loyalty.pontos >= 500) nivelCorreto = 'Prata';
        
        if (nivelCorreto !== loyalty.nivel) {
            loyalty.nivel = nivelCorreto;
            await db.ref(`fidelidade/${currentUser.uid}`).update({ nivel: nivelCorreto });
            showToast(`🎉 Parabéns! Você alcançou o nível ${nivelCorreto}!`, 'success');
        }
        
        return loyalty;
    } catch (error) {
        console.error('Erro ao buscar informações de fidelidade:', error);
        return { pontos: 0, nivel: 'Bronze', historico: [], dataAtualizacao: Date.now() };
    }
}

async function addLoyaltyPoints(pontos, motivo) {
    try {
        const loyaltySnap = await db.ref(`fidelidade/${currentUser.uid}`).once('value');
        let loyalty = loyaltySnap.val();

        // Inicializar estrutura se não existir
        if (!loyalty) {
            loyalty = { 
                pontos: 0, 
                nivel: 'Bronze', 
                historico: [],
                dataAtualizacao: Date.now()
            };
            await db.ref(`fidelidade/${currentUser.uid}`).set(loyalty);
        }
        
        // Garantir que historico é um array
        if (!loyalty.historico) {
            loyalty.historico = [];
        }
        
        const pontosAntigos = loyalty.pontos || 0;
        loyalty.pontos = (loyalty.pontos || 0) + pontos;
        
        // Adicionar ao histórico com verificação
        loyalty.historico.push({ 
            pontos: pontos, 
            motivo: motivo, 
            data: Date.now(),
            pontosAntes: pontosAntigos,
            pontosDepois: loyalty.pontos
        });
        
        loyalty.dataAtualizacao = Date.now();

        let novoNivel = 'Bronze';
        if (loyalty.pontos >= 1000) novoNivel = 'Ouro';
        else if (loyalty.pontos >= 500) novoNivel = 'Prata';

        if (novoNivel !== loyalty.nivel) {
            loyalty.nivel = novoNivel;
            await db.ref(`fidelidade/${currentUser.uid}`).update({
                pontos: loyalty.pontos,
                nivel: novoNivel,
                historico: loyalty.historico,
                dataAtualizacao: Date.now()
            });
            showToast(`🏆 PARABÉNS! Você subiu para o nível ${novoNivel}! 🏆`, 'success');
        } else {
            await db.ref(`fidelidade/${currentUser.uid}`).update({
                pontos: loyalty.pontos,
                historico: loyalty.historico,
                dataAtualizacao: Date.now()
            });
            if (pontos > 0) {
                showToast(`✨ +${pontos} pontos de fidelidade! Total: ${loyalty.pontos} pontos`, 'success');
            }
        }
        
        if (activeNav === 'perfil') renderPerfil();
        
        return loyalty.pontos;
    } catch (error) {
        console.error('Erro ao adicionar pontos de fidelidade:', error);
        // Não mostrar toast de erro para não atrapalhar o fluxo principal
        return 0;
    }
}

async function showLoyaltyModal() {
    const loyalty = await getLoyaltyInfo();
    const nextLevel = loyalty.nivel === 'Bronze' ? 'Prata (500 pontos)' : (loyalty.nivel === 'Prata' ? 'Ouro (1000 pontos)' : 'Max');
    const pointsToNext = loyalty.nivel === 'Bronze' ? 500 - loyalty.pontos : (loyalty.nivel === 'Prata' ? 1000 - loyalty.pontos : 0);

    await Swal.fire({
        title: `Nível ${loyalty.nivel}`,
        html: `
            <div class="text-center">
                <i class="fas fa-crown fa-3x mb-2" style="color: #D4AF37;"></i>
                <div class="display-4 fw-bold" style="font-size: 48px;">${loyalty.pontos}</div>
                <div class="small">Pontos acumulados</div>
                <div class="mt-3" style="background: #E2E8F0; border-radius: 10px; height: 10px;">
                    <div style="width: ${loyalty.nivel === 'Bronze' ? (loyalty.pontos / 500 * 100) : (loyalty.nivel === 'Prata' ? (loyalty.pontos / 1000 * 100) : 100)}%; height: 10px; background: #D4AF37; border-radius: 10px;"></div>
                </div>
                <div class="small mt-1">Próximo: ${nextLevel} (${Math.max(0, pointsToNext)} pontos)</div>
                <div class="mt-3 text-start">
                    <strong>Benefícios:</strong>
                    <ul class="small mt-2" style="padding-left: 20px;">
                        <li>🏅 Bronze (0-499 pts): Descontos básicos</li>
                        <li>🥈 Prata (500-999 pts): 5% de desconto em compras</li>
                        <li>🥇 Ouro (1000+ pts): 10% de desconto + Frete Grátis</li>
                    </ul>
                </div>
            </div>
        `,
        confirmButtonText: 'Fechar',
        confirmButtonColor: '#0A2647'
    });
}

// ==================== FUNÇÃO DE DENÚNCIA ====================

async function reportContent(tipo, id, nome) {
    const { value: motivo } = await Swal.fire({
        title: `Denunciar ${tipo === 'publicacao' ? 'Publicação' : 'Perfil'}`,
        html: `
            <p>Você está denunciando: <strong>${escapeHtml(nome)}</strong></p>
            <textarea id="motivoDenuncia" class="swal2-textarea" placeholder="Descreva o motivo da denúncia..." rows="4"></textarea>
            <select id="categoriaDenuncia" class="swal2-select" style="margin-top: 10px;">
                <option value="">Selecione a categoria</option>
                <option value="conteudo_inapropriado">Conteúdo inapropriado</option>
                <option value="spam">Spam ou publicidade enganosa</option>
                <option value="discurso_odio">Discurso de ódio</option>
                <option value="fraude">Fraude ou golpe</option>
                <option value="outro">Outro motivo</option>
            </select>
        `,
        showCancelButton: true,
        confirmButtonText: 'Enviar Denúncia',
        confirmButtonColor: '#DC2626',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const motivoTexto = document.getElementById('motivoDenuncia').value.trim();
            const categoria = document.getElementById('categoriaDenuncia').value;

            if (!motivoTexto) {
                Swal.showValidationMessage('Descreva o motivo da denúncia');
                return false;
            }

            if (!categoria) {
                Swal.showValidationMessage('Selecione uma categoria');
                return false;
            }

            return { motivo: motivoTexto, categoria: categoria };
        }
    });

    if (motivo) {
        const dataDenuncia = {
            tipo: tipo,
            id: id,
            nome: nome,
            denunciadoPor: currentUser.uid,
            denunciadoPorNome: currentUserData?.nome || currentUserData?.nomeEmpresa || currentUser.displayName,
            categoria: motivo.categoria,
            motivo: motivo.motivo,
            data: Date.now()
        };

        await db.ref('denuncias').push().set(dataDenuncia);

        showToast('Denúncia enviada! Obrigado por ajudar a manter a comunidade segura.');
    }
}

// ==================== NAVEGAÇÃO ====================

function setActiveNav(nav) {
    activeNav = nav;
    
    // Atualizar navegação desktop
    document.querySelectorAll('.desktop-nav .nav-item').forEach(btn => {
        if (btn.dataset.nav === nav) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Atualizar navegação mobile
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        if (btn.dataset.nav === nav) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (nav === 'feed') renderFeed();
    else if (nav === 'publicar') renderPublicar();
    else if (nav === 'chats') renderChats();
    else if (nav === 'grupos') renderGrupos();
    else if (nav === 'perfil') renderPerfil();
    else if (nav === 'dashboard') renderDashboard();
    else if (nav === 'carrinho') renderCarrinho();
    else if (nav === 'pedidos') renderMeusPedidosPage();
}

document.querySelectorAll('.desktop-nav .nav-item, .bottom-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => setActiveNav(btn.dataset.nav));
});

document.getElementById('mobilePublishBtn')?.addEventListener('click', () => {
    if (currentUserType === 'empresa') {
        setActiveNav('publicar');
    } else {
        showToast('Apenas empresas podem publicar', 'error');
    }
});

function updatePublishButton() {
    const publishBtns = document.querySelectorAll('#publishNavBtn, #mobilePublishBtn');
    publishBtns.forEach(btn => {
        if (btn) {
            btn.style.display = currentUserType === 'empresa' ? 'flex' : 'none';
        }
    });
}

function updateBadges() {
    const badges = document.querySelectorAll('#unreadChatsBadge, #unreadChatsBadgeMobile');
    badges.forEach(badge => {
        if (badge) {
            if (unreadChatsCount > 0) {
                badge.style.display = 'flex';
                badge.innerText = unreadChatsCount > 9 ? '9+' : unreadChatsCount;
            } else {
                badge.style.display = 'none';
            }
        }
    });
}

// ==================== CARREGAR DADOS EM TEMPO REAL ====================

function loadEmpresas() {
    db.ref('empresas').on('value', (snapshot) => {
        allEmpresas = [];
        snapshot.forEach(child => {
            allEmpresas.push({ id: child.key, ...child.val() });
        });
        if (activeNav === 'feed') renderFeed();
    });
}

function loadStorysRealtime() {
    if (storysListener) storysListener.off();

    storysListener = db.ref('storys').orderByChild('dataCriacao');
    storysListener.on('value', (snapshot) => {
        allStorys = [];
        snapshot.forEach(child => {
            allStorys.push({ id: child.key, ...child.val() });
        });
        allStorys.reverse();
        if (activeNav === 'feed') renderFeed();
        if (activeNav === 'perfil') renderPerfil();
    });
}

function loadPublicacoesRealtime() {
    if (publicacoesListener) publicacoesListener.off();

    publicacoesListener = db.ref('publicacoes').orderByChild('dataCriacao');
    publicacoesListener.on('value', (snapshot) => {
        allPublicacoes = [];
        snapshot.forEach(child => {
            allPublicacoes.push({ id: child.key, ...child.val() });
        });
        allPublicacoes.reverse();
        if (activeNav === 'feed') renderFeed();
        if (activeNav === 'perfil') renderPerfil();
        if (activeNav === 'dashboard') renderDashboard();
    });
}

async function loadSeguindo() {
    if (!currentUser) return;
    const snapshot = await db.ref(`seguindo/${currentUser.uid}`).once('value');
    seguindoIds = [];
    snapshot.forEach(child => {
        seguindoIds.push(child.key);
    });
}

async function loadSeguidores() {
    if (!currentUser) return;
    const snapshot = await db.ref(`seguidores/${currentUser.uid}`).once('value');
    seguidoresIds = [];
    snapshot.forEach(child => {
        seguidoresIds.push(child.key);
    });
}

function loadUnreadChats() {
    db.ref('chats').on('value', async (snapshot) => {
        let unread = 0;
        const chats = snapshot.val() || {};
        for (const [key, chat] of Object.entries(chats)) {
            if (chat.participantes && chat.participantes.includes(currentUser?.uid)) {
                const mensagens = chat.mensagens || {};
                const unreadFromUser = Object.values(mensagens).filter(m => m.para === currentUser?.uid && !m.lida).length;
                unread += unreadFromUser;
            }
        }
        unreadChatsCount = unread;
        updateBadges();
        if (activeNav === 'chats') renderChats();
    });
}

async function markMessagesAsRead(chatId) {
    const messagesRef = db.ref(`chats/${chatId}/mensagens`);
    const snapshot = await messagesRef.once('value');
    const updates = {};
    snapshot.forEach(child => {
        const msg = child.val();
        if (msg.para === currentUser.uid && !msg.lida) {
            updates[`${child.key}/lida`] = true;
        }
    });
    if (Object.keys(updates).length > 0) {
        await messagesRef.update(updates);
        loadUnreadChats();
    }
}

// ==================== STORYS ====================

async function showNovoStoryModal() {
    if (currentUserType !== 'empresa') {
        showToast('Apenas empresas podem publicar stories', 'error');
        return;
    }
    
    const { value: formValues } = await Swal.fire({
        title: 'Publicar Story',
        html: `
            <textarea id="storyTexto" class="swal2-textarea" placeholder="Digite o texto do seu story..." rows="3"></textarea>
            <input type="file" id="storyImagem" accept="image/jpeg,image/png,image/jpg">
            <div id="storyPreview" class="mt-2"></div>
            <p class="small text-muted mt-2">Máximo 300KB</p>
        `,
        showCancelButton: true,
        confirmButtonText: 'Publicar',
        confirmButtonColor: '#0A2647',
        preConfirm: () => {
            const texto = document.getElementById('storyTexto').value.trim();
            const file = document.getElementById('storyImagem').files[0];
            if (!texto && !file) {
                Swal.showValidationMessage('Adicione um texto ou imagem');
                return false;
            }
            return { texto, file };
        }
    });

    if (formValues) {
        let imagemBase64 = null;
        if (formValues.file) {
            if (formValues.file.size > 300 * 1024) {
                showToast('Imagem muito grande! Máximo 300KB', 'error');
                return;
            }
            imagemBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(formValues.file);
            });
        }

        const novoStory = {
            texto: formValues.texto || '',
            imagemUrl: imagemBase64,
            empresaId: currentUser.uid,
            empresaNome: currentUserData?.nomeEmpresa || currentUser.displayName,
            dataCriacao: Date.now(),
            visualizadoPor: {}
        };

        await db.ref('storys').push().set(novoStory);
        showToast('Story publicado!');
        renderFeed();
    }
}

async function openMultiStory(empresaId, isOwn = false) {
    const empresaStorys = allStorys.filter(s => s.empresaId === empresaId);
    if (empresaStorys.length === 0) {
        if (isOwn) showToast('Você ainda não publicou nenhum story', 'info');
        else showToast('Esta empresa não possui storys', 'error');
        return;
    }

    currentStoryList = empresaStorys;
    currentStoryIndex = 0;
    currentStoryEmpresaId = empresaId;

    showStoryByIndex(0, isOwn);
}

async function showStoryByIndex(index, isOwn) {
    if (index < 0 || index >= currentStoryList.length) {
        closeStoryViewer();
        return;
    }

    const story = currentStoryList[index];
    currentStoryIndex = index;

    if (!isOwn && currentUser) {
        await marcarStoryVisualizado(story.id);
    }

    const existingViewer = document.querySelector('.story-fullscreen');
    if (existingViewer) existingViewer.remove();

    const empresaNome = story.empresaNome || 'Empresa';
    const visualizadoPor = story.visualizadoPor || {};
    const viewersIds = Object.keys(visualizadoPor);

    let progressBarsHtml = '<div class="story-progress-bar">';
    for (let i = 0; i < currentStoryList.length; i++) {
        progressBarsHtml += `
            <div class="story-progress-segment">
                <div class="story-progress-fill" id="progressFill${i}" style="width: ${i < index ? '100%' : (i === index ? '0%' : '0%')}"></div>
            </div>
        `;
    }
    progressBarsHtml += '</div>';

    const storyDiv = document.createElement('div');
    storyDiv.className = 'story-fullscreen';
    storyDiv.innerHTML = `
        ${progressBarsHtml}
        <button class="close-story"><i class="fas fa-times"></i></button>
        ${isOwn ? '<button class="delete-story-btn" id="deleteStoryBtn"><i class="fas fa-trash"></i></button>' : ''}
        ${currentStoryList.length > 1 ? '<button class="story-nav prev"><i class="fas fa-chevron-left"></i></button>' : ''}
        ${currentStoryList.length > 1 ? '<button class="story-nav next"><i class="fas fa-chevron-right"></i></button>' : ''}
        <div class="story-content">
            ${story.imagemUrl ? `<img src="${story.imagemUrl}" alt="Story">` : ''}
            <div class="story-text">${escapeHtml(story.texto || '')}</div>
        </div>
    `;

    if (viewersIds.length > 0 && isOwn) {
        const viewersPromises = viewersIds.map(async (uid) => {
            const nome = await getUserName(uid);
            return `<div class="viewer-item"><i class="fas fa-eye"></i> ${escapeHtml(nome)} - ${formatDate(visualizadoPor[uid])}</div>`;
        });
        const viewersHtml = await Promise.all(viewersPromises);
        const viewsInfoDiv = document.createElement('div');
        viewsInfoDiv.className = 'story-views-info';
        viewsInfoDiv.innerHTML = `<strong><i class="fas fa-eye"></i> ${viewersIds.length} visualizações</strong><div class="viewers-list mt-2">${viewersHtml.join('')}</div>`;
        storyDiv.appendChild(viewsInfoDiv);
    }

    if (!isOwn) {
        const respondDiv = document.createElement('div');
        respondDiv.className = 'respond-story';
        respondDiv.innerHTML = `
            <input type="text" id="storyResponseInput" placeholder="Responder para ${escapeHtml(empresaNome)}...">
            <button id="sendStoryResponseBtn">Enviar</button>
        `;
        storyDiv.appendChild(respondDiv);
    }

    document.body.appendChild(storyDiv);

    startStoryTimer(storyDiv, isOwn);

    storyDiv.querySelector('.close-story').onclick = () => closeStoryViewer();

    if (isOwn) {
        const deleteBtn = storyDiv.querySelector('#deleteStoryBtn');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                const result = await Swal.fire({
                    title: 'Excluir story?',
                    text: 'Esta ação não pode ser desfeita',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#DC2626',
                    confirmButtonText: 'Sim, excluir'
                });
                if (result.isConfirmed) {
                    await db.ref(`storys/${story.id}`).remove();
                    showToast('Story excluído');
                    closeStoryViewer();
                    renderFeed();
                }
            };
        }
    }

    const prevBtn = storyDiv.querySelector('.story-nav.prev');
    const nextBtn = storyDiv.querySelector('.story-nav.next');

    if (prevBtn) {
        prevBtn.onclick = () => {
            stopStoryTimer();
            showStoryByIndex(currentStoryIndex - 1, isOwn);
        };
    }

    if (nextBtn) {
        nextBtn.onclick = () => {
            stopStoryTimer();
            showStoryByIndex(currentStoryIndex + 1, isOwn);
        };
    }

    if (!isOwn) {
        const sendBtn = storyDiv.querySelector('#sendStoryResponseBtn');
        const input = storyDiv.querySelector('#storyResponseInput');

        sendBtn.onclick = async () => {
            const resposta = input.value.trim();
            if (!resposta) return;

            const chatId = [currentUser.uid, story.empresaId].sort().join('_');
            const messagesRef = db.ref(`chats/${chatId}/mensagens`);
            await messagesRef.push({
                texto: resposta,
                de: currentUser.uid,
                para: story.empresaId,
                data: Date.now(),
                lida: false,
                isRespostaStory: true,
                storyTexto: story.texto
            });

            await db.ref(`chats/${chatId}`).update({
                ultimaMensagem: `📷 Respondeu a um story: ${resposta.substring(0, 30)}`,
                ultimaAtualizacao: Date.now(),
                participantes: [currentUser.uid, story.empresaId]
            });

            showToast('Resposta enviada!');
            closeStoryViewer();
        };

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendBtn.click();
        });
    }
}

function startStoryTimer(storyDiv, isOwn) {
    if (storyTimer) clearInterval(storyTimer);

    const duration = 5000;
    const startTime = Date.now();
    const progressFill = document.getElementById(`progressFill${currentStoryIndex}`);

    storyTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min((elapsed / duration) * 100, 100);
        if (progressFill) progressFill.style.width = percent + '%';

        if (elapsed >= duration) {
            stopStoryTimer();
            if (currentStoryIndex + 1 < currentStoryList.length) {
                showStoryByIndex(currentStoryIndex + 1, isOwn);
            } else {
                closeStoryViewer();
            }
        }
    }, 100);
}

function stopStoryTimer() {
    if (storyTimer) {
        clearInterval(storyTimer);
        storyTimer = null;
    }
}

function closeStoryViewer() {
    stopStoryTimer();
    const viewer = document.querySelector('.story-fullscreen');
    if (viewer) viewer.remove();
    currentStoryList = [];
    currentStoryIndex = 0;
}

async function marcarStoryVisualizado(storyId) {
    const story = allStorys.find(s => s.id === storyId);
    if (!story) return;

    const visualizadoPor = story.visualizadoPor || {};
    if (!visualizadoPor[currentUser.uid]) {
        visualizadoPor[currentUser.uid] = Date.now();
        await db.ref(`storys/${storyId}`).update({ visualizadoPor });
    }
}

// ==================== TELA FEED ====================

async function renderFeed() {
    const main = document.getElementById('mainContent');
    if (!main) return;

    await loadSeguindo();

    let html = `
        <div class="header">
            <h2><i class="fas fa-fire" style="color: #D4AF37;"></i> Feed</h2>
            ${currentUserType === 'empresa' ? '<button id="btnNovoStory" class="badge-gold" style="border: none;"><i class="fas fa-plus"></i> Novo Story</button>' : ''}
        </div>
        <div class="search-bar">
            <i class="fas fa-search"></i>
            <input type="text" id="searchFeedInput" placeholder="Pesquisar empresas...">
        </div>
        <div id="feedContainer"></div>
    `;
    main.innerHTML = html;

    if (currentUserType === 'empresa') {
        document.getElementById('btnNovoStory')?.addEventListener('click', showNovoStoryModal);
    }

    const storysPorEmpresa = {};
    for (const story of allStorys) {
        if (!storysPorEmpresa[story.empresaId]) {
            storysPorEmpresa[story.empresaId] = [];
        }
        storysPorEmpresa[story.empresaId].push(story);
    }

    let empresasToShow = [];

    if (currentUserType === 'cliente') {
        for (const empresaId of seguindoIds) {
            const empresa = allEmpresas.find(e => e.id === empresaId);
            if (empresa) empresasToShow.push({ ...empresa, isFollowing: true });
        }

        const empresasComStorys = new Set();
        for (const story of allStorys.slice(0, 30)) {
            if (!seguindoIds.includes(story.empresaId) && story.empresaId !== currentUser.uid) {
                empresasComStorys.add(story.empresaId);
            }
        }
        for (const empresaId of empresasComStorys) {
            const empresa = allEmpresas.find(e => e.id === empresaId);
            if (empresa && !empresasToShow.find(e => e.id === empresaId)) {
                empresasToShow.push({ ...empresa, isFollowing: false });
            }
        }
    } else {
        for (const empresa of allEmpresas) {
            if (empresa.id !== currentUser.uid) {
                empresasToShow.push({ ...empresa, isFollowing: false });
            }
        }
    }

    if (currentUserType === 'empresa') {
        const minhaEmpresa = allEmpresas.find(e => e.id === currentUser.uid);
        if (minhaEmpresa) {
            empresasToShow.unshift({ ...minhaEmpresa, isFollowing: false, isOwn: true });
        }
    }

    const searchInput = document.getElementById('searchFeedInput');
    const container = document.getElementById('feedContainer');

    function filterEmpresas(term) {
        const filtered = empresasToShow.filter(e =>
            (e.nomeEmpresa || '').toLowerCase().includes(term.toLowerCase())
        );
        renderFeedContent(filtered);
    }

    function renderFeedContent(empresas) {
        if (empresas.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-fire fa-3x mb-3"></i><p>Nenhuma empresa encontrada</p></div>';
            return;
        }

        let htmlContent = '<div class="storys-row">';

        for (const empresa of empresas) {
            const storysDaEmpresa = storysPorEmpresa[empresa.id] || [];
            const temStory = storysDaEmpresa.length > 0;
            const ultimoStory = storysDaEmpresa[0];
            const visto = ultimoStory?.visualizadoPor?.[currentUser?.uid];
            const isOwn = empresa.isOwn === true;
            const storyCount = storysDaEmpresa.length;

            htmlContent += `
                <div class="story-circle" 
                     data-empresa-id="${empresa.id}" 
                     data-tem-story="${temStory}"
                     data-is-own="${isOwn}">
                    <div class="story-avatar ${visto && !isOwn ? 'story-viewed' : ''}" style="position: relative;">
                        ${ultimoStory?.imagemUrl 
                            ? `<img src="${ultimoStory.imagemUrl}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><i class="fas fa-store" style="display: none;"></i>`
                            : `<i class="fas fa-store"></i>`
                        }
                        ${storyCount > 0 && isOwn ? `<span class="story-views-badge">${storyCount}</span>` : ''}
                        ${storyCount > 1 && !isOwn ? `<span class="story-views-badge" style="background: #D4AF37;">${storyCount}</span>` : ''}
                    </div>
                    <div class="story-name">${escapeHtml((empresa.nomeEmpresa || 'Empresa').substring(0, 15))}</div>
                    ${!temStory && !isOwn ? '<div class="small text-muted">Sem story</div>' : ''}
                    ${isOwn ? '<div class="small text-muted" style="color: #D4AF37;">Meus Storys</div>' : ''}
                </div>
                
            `;
        }

        htmlContent += '</div>';

        const publicacoesPorEmpresa = {};
        let publicacoesToShow = allPublicacoes;

        if (currentUserType === 'empresa') {
            publicacoesToShow = allPublicacoes.filter(p => p.empresaId !== currentUser.uid);
        }

        for (const pub of publicacoesToShow) {
            if (!publicacoesPorEmpresa[pub.empresaId] || publicacoesPorEmpresa[pub.empresaId].dataCriacao < pub.dataCriacao) {
                publicacoesPorEmpresa[pub.empresaId] = pub;
            }
        }

        const publicacoesUnicas = Object.values(publicacoesPorEmpresa);
        publicacoesUnicas.sort((a, b) => (b.dataCriacao || 0) - (a.dataCriacao || 0));

        if (publicacoesUnicas.length > 0) {
            htmlContent += '<div class="header mt-3"><h2><i class="fas fa-store"></i> Destaques</h2></div>';
            htmlContent += '<div class="grid-2x2">';

            for (const pub of publicacoesUnicas) {
                const curtidasCount = pub.curtidasCount || 0;
                const comentariosCount = pub.comentarios ? Object.keys(pub.comentarios).length : 0;
                const userLiked = pub.curtidas && currentUser && pub.curtidas[currentUser.uid];
                const primeiraImagem = pub.imagens && pub.imagens.length > 0 ? pub.imagens[0] : null;
                
                const pubData = JSON.stringify(pub).replace(/"/g, '&quot;');

                htmlContent += `
                    <div class="publicacao-card" data-pub-id="${pub.id}" data-empresa-id="${pub.empresaId}">
                        <div class="publicacao-menu" data-pub-id="${pub.id}" data-pub-nome="${escapeHtml(pub.titulo)}" data-empresa-nome="${escapeHtml(pub.empresaNome)}">
                            <i class="fas fa-ellipsis-v"></i>
                        </div>
                        ${primeiraImagem
                            ? `<img src="${primeiraImagem}" class="publicacao-image" onerror="this.src='https://placehold.co/400x400?text=Sem+Imagem'">`
                            : `<div class="publicacao-image d-flex align-items-center justify-content-center bg-light"><i class="fas fa-image fa-2x text-muted"></i></div>`
                        }
                        <div class="publicacao-info">
                            <div class="publicacao-titulo">${escapeHtml(pub.titulo)}</div>
                            <div class="publicacao-preco">${formatNumber(pub.preco)} KZ</div>
                            <div class="publicacao-empresa" data-empresa-id="${pub.empresaId}">
                                <i class="fas fa-store"></i> ${escapeHtml(pub.empresaNome || 'Empresa')}
                            </div>
                            <div class="publicacao-stats">
                                <span class="like-pub-btn ${userLiked ? 'liked' : ''}" data-pub-id="${pub.id}">
                                    <i class="fas fa-heart"></i> <span class="like-count">${curtidasCount}</span>
                                </span>
                                <span class="comment-pub-btn" data-pub-id="${pub.id}">
                                    <i class="fas fa-comment"></i> <span class="comment-count">${comentariosCount}</span>
                                </span>
                            </div>
                            <div class="d-flex gap-2 mt-2">
                                <button class="btn-negociar-card negociar-pub-btn flex-grow-1" data-empresa-id="${pub.empresaId}" data-empresa-nome="${escapeHtml(pub.empresaNome || 'Empresa')}">
                                    <i class="fas fa-comment-dollar"></i> Negociar
                                </button>
                                <button class="btn-comprar-card comprar-pub-btn" data-pub='${pubData}'>
                                    <i class="fas fa-cart-plus"></i> Comprar
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }

            htmlContent += '</div>';
        }

        container.innerHTML = htmlContent;

        document.querySelectorAll('.story-circle').forEach(el => {
            el.addEventListener('click', () => {
                const empresaId = el.dataset.empresaId;
                const temStory = el.dataset.temStory === 'true';
                const isOwn = el.dataset.isOwn === 'true';

                if (temStory) {
                    openMultiStory(empresaId, isOwn);
                } else if (isOwn) {
                    showToast('Você ainda não publicou nenhum story. Clique em "Novo Story" para criar um!', 'info');
                } else {
                    showToast('Esta empresa ainda não publicou nenhum story', 'error');
                }
            });
        });

        document.querySelectorAll('.like-pub-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const pubId = btn.dataset.pubId;
                await toggleLikePublicacao(pubId);
            });
        });

        document.querySelectorAll('.comment-pub-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const pubId = btn.dataset.pubId;
                await openChatIndividualByPub(pubId);
            });
        });

        document.querySelectorAll('.negociar-pub-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const empresaId = btn.dataset.empresaId;
                const empresaNome = btn.dataset.empresaNome;
                openChatIndividual(empresaId, empresaNome);
            });
        });

        document.querySelectorAll('.comprar-pub-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                    const pubData = btn.getAttribute('data-pub');
                    if (pubData) {
                        const pub = JSON.parse(pubData);
                        adicionarAoCarrinho(pub);
                    }
                } catch(error) {
                    console.error('Erro ao adicionar ao carrinho:', error);
                    showToast('Erro ao adicionar produto', 'error');
                }
            });
        });

        document.querySelectorAll('.publicacao-empresa').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const empresaId = el.dataset.empresaId;
                if (empresaId) openEmpresaProfileScreen(empresaId);
            });
        });

        document.querySelectorAll('.publicacao-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.like-pub-btn') &&
                    !e.target.closest('.comment-pub-btn') &&
                    !e.target.closest('.negociar-pub-btn') &&
                    !e.target.closest('.comprar-pub-btn') &&
                    !e.target.closest('.publicacao-empresa') &&
                    !e.target.closest('.publicacao-menu')) {
                    const pubId = card.dataset.pubId;
                    openPublicacaoDetalhes(pubId);
                }
            });
        });

        document.querySelectorAll('.publicacao-menu').forEach(menu => {
            menu.addEventListener('click', (e) => {
                e.stopPropagation();
                const pubId = menu.dataset.pubId;
                const pubNome = menu.dataset.pubNome;
                const empresaNome = menu.dataset.empresaNome;

                Swal.fire({
                    title: 'Opções',
                    html: `
                        <button id="reportPubBtn" class="btn-danger-custom" style="width: 100%; margin-bottom: 10px;">
                            <i class="fas fa-flag me-2"></i> Denunciar Publicação
                        </button>
                        <button id="reportProfileBtn" class="btn-danger-custom" style="width: 100%;">
                            <i class="fas fa-user-slash me-2"></i> Denunciar Perfil
                        </button>
                    `,
                    showConfirmButton: false,
                    showCancelButton: true,
                    cancelButtonText: 'Fechar',
                    didOpen: () => {
                        document.getElementById('reportPubBtn').onclick = () => {
                            Swal.close();
                            reportContent('publicacao', pubId, pubNome);
                        };
                        document.getElementById('reportProfileBtn').onclick = () => {
                            Swal.close();
                            const empresaId = document.querySelector(`.publicacao-card[data-pub-id="${pubId}"]`)?.dataset.empresaId;
                            reportContent('perfil', empresaId, empresaNome);
                        };
                    }
                });
            });
        });
    }

    renderFeedContent(empresasToShow);

    if (searchInput) {
        searchInput.addEventListener('input', (e) => filterEmpresas(e.target.value));
    }
}

async function toggleLikePublicacao(pubId) {
    if (!currentUser) return;

    const pubRef = db.ref(`publicacoes/${pubId}`);
    const snapshot = await pubRef.once('value');
    const pub = snapshot.val();
    if (!pub) return;

    const curtidas = pub.curtidas || {};
    let curtidasCount = pub.curtidasCount || 0;

    if (curtidas[currentUser.uid]) {
        delete curtidas[currentUser.uid];
        curtidasCount--;
        showToast('Curtida removida');
    } else {
        curtidas[currentUser.uid] = Date.now();
        curtidasCount++;
        showToast('Você curtiu!');
    }

    await pubRef.update({ curtidas, curtidasCount });
    renderFeed();
}

// ==================== DETALHES DA PUBLICAÇÃO ====================

async function openPublicacaoDetalhes(pubId) {
    const pub = allPublicacoes.find(p => p.id === pubId);
    if (!pub) return;
    
    const imagens = pub.imagens || [];
    const curtidasCount = pub.curtidasCount || 0;
    const comentarios = pub.comentarios || {};
    const comentariosList = Object.entries(comentarios).sort((a, b) => b[1].data - a[1].data);
    const userLiked = pub.curtidas && currentUser && pub.curtidas[currentUser.uid];

    let imagensHtml = '';
    if (imagens.length > 0) {
        imagensHtml = `<img src="${imagens[0]}" class="publicacao-modal-image" onclick="window.open('${imagens[0]}', '_blank')" style="border-radius: 16px; width: 100%; cursor: pointer;">`;
        if (imagens.length > 1) imagensHtml += '<div class="small text-muted mb-2 text-center">+ ' + (imagens.length - 1) + ' imagem(ns)</div>';
    }

    let comentariosHtml = '<div class="comentarios-container mt-3"><strong><i class="fas fa-comments"></i> Comentários</strong><div id="comentariosList" class="mt-2">';
    
    if (comentariosList.length === 0) {
        comentariosHtml += '<div class="text-muted text-center py-3">💬 Nenhum comentário ainda. Seja o primeiro a comentar!</div>';
    } else {
        for (const [comentarioId, comentario] of comentariosList) {
            const nomeUsuario = await getUserName(comentario.userId);
            comentariosHtml += `
                <div class="comentario-item" style="padding: 12px 0; border-bottom: 1px solid #E2E8F0;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <div style="width: 32px; height: 32px; background: #0A2647; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;">
                            <i class="fas fa-user" style="font-size: 14px;"></i>
                        </div>
                        <div>
                            <div style="font-weight: 700; font-size: 13px; color: #0A2647;">${escapeHtml(nomeUsuario)}</div>
                            <div style="font-size: 10px; color: #94A3B8;">${formatDate(comentario.data)}</div>
                        </div>
                    </div>
                    <div class="comentario-texto" style="font-size: 13px; color: #334155; margin-left: 42px;">${escapeHtml(comentario.texto)}</div>
                </div>
            `;
        }
    }
    comentariosHtml += '</div></div>';

    const modal = document.createElement('div');
    modal.className = 'publicacao-modal';
    modal.innerHTML = `
        <div class="publicacao-modal-content">
            <div class="publicacao-modal-header">
                <h5 class="m-0">${escapeHtml(pub.titulo)}</h5>
                <button class="publicacao-modal-close">&times;</button>
            </div>
            <div class="publicacao-modal-body">
                <div class="publicacao-modal-empresa empresa-profile-clickable" data-empresa-id="${pub.empresaId}" style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; cursor: pointer;">
                    <div class="publicacao-modal-avatar" style="width: 50px; height: 50px; background: linear-gradient(135deg, #0A2647, #1B3A5C); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #D4AF37;">
                        <i class="fas fa-store"></i>
                    </div>
                    <div>
                        <div style="font-weight: 700;">${escapeHtml(pub.empresaNome)}</div>
                        <div style="font-size: 11px; color: #94A3B8;">${formatDate(pub.dataCriacao)}</div>
                    </div>
                </div>
                ${imagensHtml}
                <div class="mb-3">
                    <div class="d-flex gap-3 mb-2">
                        <span id="modalLikeBtn" class="${userLiked ? 'liked' : ''}" style="cursor: pointer; color: ${userLiked ? '#EF4444' : '#94A3B8'};">
                            <i class="fas fa-heart"></i> <span id="modalLikeCount">${curtidasCount}</span>
                        </span>
                        <span style="color: #94A3B8;"><i class="fas fa-comment"></i> ${Object.keys(comentarios).length}</span>
                    </div>
                    <div><strong>💰 Preço:</strong> <span style="color: #D4AF37; font-size: 18px; font-weight: bold;">${formatNumber(pub.preco)} KZ</span></div>
                    <div class="mt-2"><strong>📝 Descrição:</strong></div>
                    <div class="text-muted">${escapeHtml(pub.descricao || 'Sem descrição')}</div>
                </div>
                ${comentariosHtml}
                <div class="add-comentario-area" style="display: flex; gap: 10px; margin-top: 16px;">
                    <input type="text" id="novoComentarioInput" placeholder="Escreva um comentário..." style="flex: 1; border: 1px solid #E2E8F0; border-radius: 30px; padding: 12px 16px; outline: none;">
                    <button id="btnComentar" style="background: #0A2647; border: none; border-radius: 30px; padding: 0 20px; color: white; cursor: pointer;">Publicar</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.publicacao-modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.querySelector('.publicacao-modal-empresa').onclick = () => { modal.remove(); openEmpresaProfileScreen(pub.empresaId); };

    const likeBtn = modal.querySelector('#modalLikeBtn');
    likeBtn.onclick = async () => {
        await toggleLikePublicacao(pubId);
        const updatedPub = allPublicacoes.find(p => p.id === pubId);
        const newLikeCount = updatedPub?.curtidasCount || 0;
        const newLiked = updatedPub?.curtidas && updatedPub.curtidas[currentUser.uid];
        modal.querySelector('#modalLikeCount').innerText = newLikeCount;
        if (newLiked) {
            likeBtn.classList.add('liked');
            likeBtn.style.color = '#EF4444';
        } else {
            likeBtn.classList.remove('liked');
            likeBtn.style.color = '#94A3B8';
        }
    };

    const comentarBtn = modal.querySelector('#btnComentar');
    const comentarioInput = modal.querySelector('#novoComentarioInput');
    comentarBtn.onclick = async () => {
        const texto = comentarioInput.value.trim();
        if (!texto) {
            showToast('Digite um comentário', 'error');
            return;
        }
        await db.ref(`publicacoes/${pubId}/comentarios`).push().set({ 
            texto: texto, 
            userId: currentUser.uid, 
            data: Date.now() 
        });
        comentarioInput.value = '';
        showToast('💬 Comentário adicionado!');
        modal.remove();
        openPublicacaoDetalhes(pubId);
    };
    comentarioInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') comentarBtn.click(); });
}

async function openChatIndividualByPub(pubId) {
    const pub = allPublicacoes.find(p => p.id === pubId);
    if (!pub) return;
    openChatIndividual(pub.empresaId, pub.empresaNome);
}

// ==================== TELA PUBLICAR ====================

async function renderPublicar() {
    const main = document.getElementById('mainContent');
    if (!main) return;

    if (currentUserType !== 'empresa') {
        main.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-store-slash fa-4x text-muted mb-3"></i>
                <h4>Apenas empresas podem publicar</h4>
                <p class="text-muted">Torne-se uma empresa para divulgar seus produtos!</p>
                <button class="btn-primary-custom" id="btnTornarEmpresa" style="width: auto; padding: 12px 30px;">
                    <i class="fas fa-building me-2"></i>Tornar-se Empresa
                </button>
            </div>
        `;
        document.getElementById('btnTornarEmpresa')?.addEventListener('click', showTornarEmpresaWizard);
        return;
    }

    main.innerHTML = `
        <div class="header">
            <h2><i class="fas fa-plus-circle" style="color: #D4AF37;"></i> Nova Publicação</h2>
        </div>
        <div class="publish-form">
            <input type="text" id="pubTitulo" class="form-control" placeholder="Título do produto/serviço *">
            <textarea id="pubDescricao" class="form-control" rows="3" placeholder="Descrição detalhada..."></textarea>
            <input type="number" id="pubPreco" class="form-control" placeholder="Preço (KZ) *">
            <select id="pubCategoria" class="form-select">
                <option value="">Selecione a categoria</option>
                <option value="alimentacao">Alimentação</option>
                <option value="moda">Moda</option>
                <option value="tecnologia">Tecnologia</option>
                <option value="servicos">Serviços</option>
                <option value="construcao">Construção</option>
                <option value="outros">Outros</option>
            </select>
            <label class="form-label">Imagens (máximo 3, até 300KB cada)</label>
            <input type="file" id="pubImagens" class="form-control" accept="image/jpeg,image/png,image/jpg" multiple>
            <div id="imagePreviewContainer" class="image-preview-grid"></div>
            <button id="btnPublicar" class="btn-primary-custom mt-2">Publicar</button>
        </div>
    `;

    let selectedImages = [];
    const imageInput = document.getElementById('pubImagens');
    const previewContainer = document.getElementById('imagePreviewContainer');

    imageInput.addEventListener('change', (e) => {
        selectedImages = [];
        previewContainer.innerHTML = '';
        const files = Array.from(e.target.files);

        if (files.length > 3) {
            showToast('Máximo 3 imagens', 'error');
            imageInput.value = '';
            return;
        }

        files.forEach((file, idx) => {
            if (file.size > 300 * 1024) {
                showToast(`Imagem ${idx + 1} muito grande (máx 300KB)`, 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                selectedImages.push(ev.target.result);
                const imgDiv = document.createElement('div');
                imgDiv.style.position = 'relative';
                imgDiv.style.display = 'inline-block';
                imgDiv.innerHTML = `
                    <img src="${ev.target.result}" class="image-preview">
                    <span class="remove-image" data-index="${selectedImages.length - 1}">×</span>
                `;
                previewContainer.appendChild(imgDiv);

                imgDiv.querySelector('.remove-image').onclick = () => {
                    selectedImages.splice(parseInt(imgDiv.querySelector('.remove-image').dataset.index), 1);
                    imgDiv.remove();
                };
            };
            reader.readAsDataURL(file);
        });
    });

    document.getElementById('btnPublicar').addEventListener('click', async () => {
        const titulo = document.getElementById('pubTitulo').value.trim();
        const descricao = document.getElementById('pubDescricao').value.trim();
        const preco = parseFloat(document.getElementById('pubPreco').value);
        const categoria = document.getElementById('pubCategoria').value;

        if (!titulo) {
            showToast('Digite o título', 'error');
            return;
        }
        if (!preco || preco <= 0) {
            showToast('Digite um preço válido', 'error');
            return;
        }
        if (selectedImages.length === 0) {
            showToast('Adicione pelo menos uma imagem', 'error');
            return;
        }

        const novaPub = {
            titulo: titulo,
            descricao: descricao,
            preco: preco,
            categoria: categoria,
            imagens: selectedImages,
            empresaId: currentUser.uid,
            empresaNome: currentUserData?.nomeEmpresa || currentUser.displayName,
            dataCriacao: Date.now(),
            curtidas: {},
            curtidasCount: 0,
            comentarios: {},
            status: 'ativo'
        };

        await db.ref('publicacoes').push().set(novaPub);
        showToast('Publicação criada com sucesso!');

        document.getElementById('pubTitulo').value = '';
        document.getElementById('pubDescricao').value = '';
        document.getElementById('pubPreco').value = '';
        document.getElementById('pubCategoria').value = '';
        imageInput.value = '';
        previewContainer.innerHTML = '';
        selectedImages = [];

        renderFeed();
    });
}

// ==================== PERFIL ====================

async function renderPerfil() {
    const main = document.getElementById('mainContent');
    if (!main) return;

    const nomeExibido = currentUserData?.nome || currentUser?.displayName || 'Usuário';
    let totalSeguindo = 0, totalSeguidores = 0;
    const loyalty = await getLoyaltyInfo();
    await carregarMeusPedidos();

    const seguindoSnap = await db.ref(`seguindo/${currentUser.uid}`).once('value');
    totalSeguindo = seguindoSnap.numChildren();
    const seguidoresSnap = await db.ref(`seguidores/${currentUser.uid}`).once('value');
    totalSeguidores = seguidoresSnap.numChildren();

    const pedidosEntregues = allMeusPedidos.filter(p => p.status === 'entregue').length;

    main.innerHTML = `
        <div class="profile-header-card">
            <div class="profile-settings-icon" id="openSettingsBtn"><i class="fas fa-cog"></i></div>
            <div class="profile-avatar-lg"><i class="fas fa-user"></i></div>
            <h3 class="fw-bold">${escapeHtml(nomeExibido)}</h3>
            <p>${currentUser?.email || ''}</p>
            <span class="badge-gold">${currentUserType === 'empresa' ? 'Empresa' : 'Cliente'}</span>
            <div class="mt-2"><i class="fas fa-crown" style="color: #D4AF37;"></i> Nível ${loyalty.nivel} (${loyalty.pontos} pts)</div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card" data-tab="seguindo"><div class="stat-number">${totalSeguindo}</div><div class="stat-label">Seguindo</div></div>
            <div class="stat-card" data-tab="seguidores"><div class="stat-number">${totalSeguidores}</div><div class="stat-label">Seguidores</div></div>
            <div class="stat-card" id="loyaltyCard"><div class="stat-number">🎖️</div><div class="stat-label">Fidelidade</div></div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card" onclick="setActiveNav('pedidos')">
                <div class="stat-number">${allMeusPedidos.length}</div>
                <div class="stat-label">Total Pedidos</div>
            </div>
            <div class="stat-card" onclick="setActiveNav('pedidos')">
                <div class="stat-number">${pedidosEntregues}</div>
                <div class="stat-label">Entregues</div>
            </div>
            <div class="stat-card" onclick="setActiveNav('pedidos')">
                <div class="stat-number">${allMeusPedidos.filter(p => p.status === 'pendente').length}</div>
                <div class="stat-label">Pendentes</div>
            </div>
        </div>
        
        <div class="profile-tab-bar">
            <div class="profile-tab ${currentProfileTab === 'pedidos' ? 'active' : ''}" data-tab="pedidos">Meus Pedidos</div>
            <div class="profile-tab ${currentProfileTab === 'cupons' ? 'active' : ''}" data-tab="cupons">Cupons Usados</div>
            ${currentUserType === 'empresa' ? `<div class="profile-tab ${currentProfileTab === 'publicacoes' ? 'active' : ''}" data-tab="publicacoes">Minhas Publicações</div>` : ''}
            ${currentUserType === 'empresa' ? `<div class="profile-tab ${currentProfileTab === 'meus_cupons' ? 'active' : ''}" data-tab="meus_cupons">Meus Cupons</div>` : ''}
        </div>
        
        <div id="profileContent"></div>
    `;

    document.querySelectorAll('.stat-card[data-tab]').forEach(card => {
        card.addEventListener('click', () => {
            const tab = card.dataset.tab;
            if (tab === 'seguidores') showSeguidoresList();
            else if (tab === 'seguindo') showSeguindoList();
        });
    });

    document.getElementById('loyaltyCard')?.addEventListener('click', showLoyaltyModal);
    document.getElementById('openSettingsBtn')?.addEventListener('click', () => document.getElementById('settingsScreen').style.display = 'flex');

    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', () => { 
            currentProfileTab = tab.dataset.tab; 
            renderPerfil(); 
        });
    });

    const profileContent = document.getElementById('profileContent');

    if (currentProfileTab === 'pedidos') {
        await renderPerfilPedidos(profileContent);
    } else if (currentProfileTab === 'cupons') {
        await renderMeusCuponsUsados(profileContent);
    } else if (currentProfileTab === 'publicacoes') {
        await renderMinhasPublicacoes(profileContent);
    } else if (currentProfileTab === 'meus_cupons' && currentUserType === 'empresa') {
        await renderMeusCuponsCriados(profileContent);
    }
}

async function renderPerfilPedidos(container) {
    await carregarMeusPedidos();
    
    if (allMeusPedidos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open fa-3x mb-3"></i>
                <p>Você ainda não fez nenhum pedido</p>
                <p class="small">Explore o feed e compre produtos para aparecerem aqui!</p>
                <button class="btn-primary-custom mt-3" onclick="setActiveNav('feed')" style="width: auto; padding: 10px 24px;">
                    <i class="fas fa-fire me-2"></i>Explorar Feed
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    for (const pedido of allMeusPedidos) {
        const statusClass = getStatusClass(pedido.status);
        
        html += `
            <div class="pedido-card">
                <div class="pedido-header">
                    <div>
                        <span class="fw-bold">Pedido #${pedido.id.substring(0, 8)}</span>
                        <span class="status-pedido ${statusClass} ms-2">${getStatusText(pedido.status)}</span>
                    </div>
                    <div class="small text-muted">${new Date(pedido.data).toLocaleString()}</div>
                </div>
                
                <div class="mb-3">
                    <strong>Itens do pedido:</strong>
                    <div class="mt-2">
                        ${pedido.itens.map(item => `
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div class="d-flex align-items-center gap-2">
                                    ${item.imagem ? `<img src="${item.imagem}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">` : ''}
                                    <span>${item.quantidade}x ${escapeHtml(item.titulo)}</span>
                                </div>
                                <span class="text-warning fw-bold">${formatNumber(item.preco * item.quantidade)} KZ</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="border-top pt-3">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                            <div class="small text-muted">📦 Entrega: ${pedido.endereco || 'Não informado'}</div>
                            ${pedido.cupomUsado ? `<div class="small text-success mt-1">🎫 Cupom: ${pedido.cupomUsado.codigo} (${formatNumber(pedido.desconto)} KZ off)</div>` : ''}
                            ${pedido.status === 'rejeitado' && pedido.motivoRejeicao ? `<div class="small text-danger mt-1">❌ Motivo: ${pedido.motivoRejeicao}</div>` : ''}
                        </div>
                        <div class="fw-bold fs-4 text-warning">${formatNumber(pedido.total)} KZ</div>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

async function renderMeusCuponsUsados(container) {
    const empresasSnap = await db.ref('empresas').once('value');
    const cuponsUsados = [];
    
    for (const [empresaId, empresa] of Object.entries(empresasSnap.val() || {})) {
        const cuponsSnap = await db.ref(`cupons/${empresaId}`).once('value');
        for (const [cupomId, cupom] of Object.entries(cuponsSnap.val() || {})) {
            if (cupom.usadosPor && cupom.usadosPor[currentUser.uid]) {
                cuponsUsados.push({
                    ...cupom,
                    id: cupomId,
                    empresaNome: empresa.nomeEmpresa,
                    dataUso: cupom.usadosPor[currentUser.uid].data,
                    pedidoId: cupom.usadosPor[currentUser.uid].pedidoId,
                    valorDesconto: cupom.usadosPor[currentUser.uid].valor
                });
            }
        }
    }
    
    cuponsUsados.sort((a, b) => b.dataUso - a.dataUso);
    
    if (cuponsUsados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-ticket-alt fa-3x mb-3"></i>
                <p>Você ainda não usou nenhum cupom</p>
                <p class="small">Aplique cupons no carrinho para ganhar descontos!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    for (const cupom of cuponsUsados) {
        html += `
            <div class="cupom-card">
                <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <div>
                        <h6 class="fw-bold">${escapeHtml(cupom.nome)}</h6>
                        <div class="cupom-codigo">${cupom.codigo}</div>
                        <div class="small mt-2">🏪 Loja: ${escapeHtml(cupom.empresaNome)}</div>
                        <div class="small">💰 Desconto: ${cupom.tipo === 'percentual' ? cupom.valor + '%' : formatNumber(cupom.valor) + ' KZ'}</div>
                        <div class="small text-muted">📅 Usado em: ${new Date(cupom.dataUso).toLocaleString()}</div>
                    </div>
                    <span class="badge-gold" style="background: #10B981; color: white; padding: 4px 12px;">Economizou ${formatNumber(cupom.valorDesconto || cupom.valor)} KZ</span>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

async function renderMeusCuponsCriados(container) {
    const cuponsSnap = await db.ref(`cupons/${currentUser.uid}`).once('value');
    const cupons = [];
    cuponsSnap.forEach(child => cupons.push({ id: child.key, ...child.val() }));
    cupons.sort((a, b) => b.dataCriacao - a.dataCriacao);
    
    if (cupons.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-ticket-alt fa-3x mb-3"></i>
                <p>Você ainda não criou nenhum cupom</p>
                <p class="small">Clique no botão + na tela de Cupons para criar</p>
                <button class="btn-primary-custom mt-3" onclick="openCuponsScreen()" style="width: auto; padding: 10px 24px;">
                    <i class="fas fa-plus me-2"></i>Criar Cupom
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    for (const cupom of cupons) {
        const expirado = cupom.validade && cupom.validade < Date.now();
        const ativo = !expirado && cupom.ativo !== false;
        
        html += `
            <div class="cupom-card" style="${!ativo ? 'opacity: 0.6;' : ''}">
                <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                    <div>
                        <h5 class="fw-bold mb-1">${escapeHtml(cupom.nome)}</h5>
                        <div class="cupom-codigo">📋 ${cupom.codigo}</div>
                    </div>
                    <span class="badge-gold">${cupom.tipo === 'percentual' ? cupom.valor + '% OFF' : formatNumber(cupom.valor) + ' KZ OFF'}</span>
                </div>
                <div class="small mb-3" style="color: #64748B;">
                    ${cupom.valorMinimo > 0 ? `<div>💰 Mínimo: ${formatNumber(cupom.valorMinimo)} KZ</div>` : '<div>💰 Sem valor mínimo</div>'}
                    ${cupom.validade ? `<div>📅 Válido até: ${new Date(cupom.validade).toLocaleDateString()}</div>` : '<div>📅 Sem validade</div>'}
                    <div>🎯 Usado: ${cupom.usadoTotal || 0} vez(es)</div>
                    <div>🏷️ Tipo: ${cupom.tipo === 'percentual' ? 'Percentual' : 'Valor fixo'}</div>
                </div>
                <div class="text-muted small">Criado em: ${new Date(cupom.dataCriacao).toLocaleDateString()}</div>
            </div>
        `;
    }
    container.innerHTML = html;
}

async function renderMinhasPublicacoes(container) {
    const minhasPublicacoes = allPublicacoes.filter(p => p.empresaId === currentUser.uid);
    
    if (minhasPublicacoes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-image fa-3x mb-3"></i>
                <p>Você ainda não tem publicações</p>
                <p class="small">Vá na aba Publicar para adicionar seus produtos!</p>
                <button class="btn-primary-custom mt-3" onclick="setActiveNav('publicar')" style="width: auto; padding: 10px 24px;">
                    <i class="fas fa-plus me-2"></i>Publicar Produto
                </button>
            </div>
        `;
        return;
    }
    
    let html = '<div class="grid-2x2">';
    for (const pub of minhasPublicacoes) {
        const primeiraImagem = pub.imagens && pub.imagens.length > 0 ? pub.imagens[0] : null;
        html += `
            <div class="publicacao-card" data-pub-id="${pub.id}" style="cursor: pointer;">
                ${primeiraImagem 
                    ? `<img src="${primeiraImagem}" class="publicacao-image" style="width: 100%; height: 160px; object-fit: cover;">` 
                    : `<div class="publicacao-image d-flex align-items-center justify-content-center bg-light" style="height: 160px;"><i class="fas fa-image fa-2x text-muted"></i></div>`
                }
                <div class="publicacao-info">
                    <div class="publicacao-titulo fw-bold">${escapeHtml(pub.titulo)}</div>
                    <div class="publicacao-preco text-warning fw-bold">${formatNumber(pub.preco)} KZ</div>
                    <div class="publicacao-stats small text-muted">
                        <span><i class="fas fa-heart"></i> ${pub.curtidasCount || 0}</span>
                        <span><i class="fas fa-comment"></i> ${pub.comentarios ? Object.keys(pub.comentarios).length : 0}</span>
                    </div>
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
    
    document.querySelectorAll('.publicacao-card').forEach(card => {
        card.addEventListener('click', () => {
            openPublicacaoDetalhes(card.dataset.pubId);
        });
    });
}

async function showSeguidoresList() {
    const seguidoresSnap = await db.ref(`seguidores/${currentUser.uid}`).once('value');
    const seguidores = [];

    for (const [uid, value] of Object.entries(seguidoresSnap.val() || {})) {
        const nome = await getUserName(uid);
        seguidores.push({ uid, nome });
    }

    let htmlContent = '<div style="max-height: 400px; overflow-y: auto;">';
    if (seguidores.length === 0) {
        htmlContent = '<div class="text-center text-muted py-5">Nenhum seguidor ainda</div>';
    } else {
        for (const seg of seguidores) {
            htmlContent += `
                <div class="membro-item">
                    <div><i class="fas fa-user-circle me-2"></i> ${escapeHtml(seg.nome)}</div>
                    <button class="btn-outline-custom btn-chat-seguidor" data-uid="${seg.uid}" data-nome="${escapeHtml(seg.nome)}" style="padding: 6px 16px; font-size: 12px;">
                        <i class="fas fa-comment"></i> Mensagem
                    </button>
                </div>
            `;
        }
    }
    htmlContent += '</div>';

    Swal.fire({
        title: 'Meus Seguidores',
        html: htmlContent,
        showConfirmButton: true,
        confirmButtonText: 'Fechar',
        didOpen: () => {
            document.querySelectorAll('.btn-chat-seguidor').forEach(btn => {
                btn.addEventListener('click', () => {
                    const uid = btn.dataset.uid;
                    const nome = btn.dataset.nome;
                    Swal.close();
                    openChatIndividual(uid, nome);
                });
            });
        }
    });
}

async function showSeguindoList() {
    const seguindoSnap = await db.ref(`seguindo/${currentUser.uid}`).once('value');
    const seguindo = [];

    for (const [uid, value] of Object.entries(seguindoSnap.val() || {})) {
        const nome = await getUserName(uid);
        seguindo.push({ uid, nome });
    }

    let htmlContent = '<div style="max-height: 400px; overflow-y: auto;">';
    if (seguindo.length === 0) {
        htmlContent = '<div class="text-center text-muted py-5">Você não segue nenhuma empresa</div>';
    } else {
        for (const seg of seguindo) {
            htmlContent += `
                <div class="membro-item">
                    <div><i class="fas fa-store me-2"></i> ${escapeHtml(seg.nome)}</div>
                    <button class="btn-outline-custom btn-visitar-perfil" data-uid="${seg.uid}" style="padding: 6px 16px; font-size: 12px;">
                        <i class="fas fa-eye"></i> Ver Perfil
                    </button>
                </div>
            `;
        }
    }
    htmlContent += '</div>';

    Swal.fire({
        title: 'Empresas que Sigo',
        html: htmlContent,
        showConfirmButton: true,
        confirmButtonText: 'Fechar',
        didOpen: () => {
            document.querySelectorAll('.btn-visitar-perfil').forEach(btn => {
                btn.addEventListener('click', () => {
                    const uid = btn.dataset.uid;
                    Swal.close();
                    openEmpresaProfileScreen(uid);
                });
            });
        }
    });
}

// ==================== PERFIL DA EMPRESA ====================

async function openEmpresaProfileScreen(empresaId) {
    const empresa = allEmpresas.find(e => e.id === empresaId);
    if (!empresa) return;

    document.getElementById('empresaProfileTitle').innerHTML = escapeHtml(empresa.nomeEmpresa || 'Empresa');
    document.getElementById('empresaProfileScreen').style.display = 'flex';

    let isFollowing = false;
    if (currentUserType === 'cliente') {
        const followRef = await db.ref(`seguindo/${currentUser.uid}/${empresaId}`).once('value');
        isFollowing = followRef.exists();
    }

    const publicacoesEmpresa = allPublicacoes.filter(p => p.empresaId === empresaId);
    const seguidoresCount = empresa.seguidoresCount || 0;

    let publicacoesHtml = '';
    if (publicacoesEmpresa.length === 0) {
        publicacoesHtml = '<div class="empty-state py-3"><i class="fas fa-box-open fa-2x mb-2"></i><p>Esta empresa ainda não possui publicações</p></div>';
    } else {
        publicacoesHtml = '<div class="grid-2x2 mt-3">';
        for (const pub of publicacoesEmpresa) {
            const primeiraImagem = pub.imagens && pub.imagens.length > 0 ? pub.imagens[0] : null;
            publicacoesHtml += `
                <div class="publicacao-card" data-pub-id="${pub.id}" style="cursor: pointer;">
                    ${primeiraImagem ? `<img src="${primeiraImagem}" class="publicacao-image" onerror="this.src='https://placehold.co/400x400?text=Sem+Imagem'" style="height: 160px;">` : `<div class="publicacao-image d-flex align-items-center justify-content-center bg-light" style="height: 160px;"><i class="fas fa-image fa-2x text-muted"></i></div>`}
                    <div class="publicacao-info">
                        <div class="publicacao-titulo">${escapeHtml(pub.titulo)}</div>
                        <div class="publicacao-preco">${formatNumber(pub.preco)} KZ</div>
                    </div>
                </div>
            `;
        }
        publicacoesHtml += '</div>';
    }

    const content = document.getElementById('empresaProfileContent');
    content.innerHTML = `
        <div class="empresa-profile-header">
            <div class="empresa-profile-avatar">
                <i class="fas fa-store fa-3x"></i>
            </div>
            <h3 class="fw-bold">${escapeHtml(empresa.nomeEmpresa || 'Empresa')}</h3>
            <p>${escapeHtml(empresa.email || '')}</p>
            <span class="badge-gold" style="background: white; color: #0A2647;">${escapeHtml(empresa.categoria || 'Negócio local')}</span>
            
            <div class="empresa-stats">
                <div class="empresa-stat">
                    <div class="value">${publicacoesEmpresa.length}</div>
                    <div class="label">Publicações</div>
                </div>
                <div class="empresa-stat">
                    <div class="value">${seguidoresCount}</div>
                    <div class="label">Seguidores</div>
                </div>
                <div class="empresa-stat">
                    <div class="value">⭐</div>
                    <div class="label">Avaliação</div>
                </div>
            </div>
        </div>
        
        <div style="padding: 20px;">
            <div class="mb-4">
                <h6><i class="fas fa-info-circle me-2"></i>Sobre a empresa</h6>
                <p class="text-muted small mt-2">${escapeHtml(empresa.descricao || 'Sem descrição')}</p>
            </div>
            
            <div class="mb-4">
                <h6><i class="fas fa-map-marker-alt me-2"></i>Localização</h6>
                <p class="text-muted small mt-2">${escapeHtml(empresa.endereco || 'Não informado')}</p>
            </div>
            
            <div class="mb-4">
                <h6><i class="fas fa-phone me-2"></i>Contato</h6>
                <p class="text-muted small mt-2"><i class="fas fa-phone"></i> ${escapeHtml(empresa.telefone || 'Não informado')}</p>
            </div>
            
            ${empresa.facebook || empresa.instagram ? `
            <div class="mb-4">
                <h6><i class="fas fa-share-alt me-2"></i>Redes Sociais</h6>
                ${empresa.facebook ? `<p class="small mt-2"><i class="fab fa-facebook me-2"></i>${escapeHtml(empresa.facebook)}</p>` : ''}
                ${empresa.instagram ? `<p class="small"><i class="fab fa-instagram me-2"></i>${escapeHtml(empresa.instagram)}</p>` : ''}
            </div>
            ` : ''}
            
            <div class="d-flex gap-2 flex-wrap">
                ${currentUserType === 'cliente' ? `
                    <button id="profileFollowBtn" class="btn-${isFollowing ? 'outline-custom' : 'primary-custom'}" style="flex: 1;">
                        <i class="fas fa-${isFollowing ? 'user-minus' : 'user-plus'} me-2"></i>
                        ${isFollowing ? 'Deixar de seguir' : 'Seguir empresa'}
                    </button>
                ` : ''}
                <button id="profileChatBtn" class="btn-primary-custom" style="flex: 1;">
                    <i class="fas fa-comment-dots me-2"></i> Mensagem
                </button>
                <button id="profileReportBtn" class="btn-danger-custom" style="flex: 0 0 auto; width: auto; padding: 12px 20px;">
                    <i class="fas fa-flag"></i>
                </button>
            </div>
        </div>
        
        <div class="px-3 pb-3">
            <h5 class="fw-bold mb-3"><i class="fas fa-store me-2"></i>Publicações da empresa</h5>
            ${publicacoesHtml}
        </div>
    `;

    if (currentUserType === 'cliente') {
        const followBtn = document.getElementById('profileFollowBtn');
        if (followBtn) {
            followBtn.addEventListener('click', async () => {
                if (isFollowing) {
                    await deixarSeguir(empresaId);
                } else {
                    await seguirEmpresa(empresaId);
                }
                openEmpresaProfileScreen(empresaId);
            });
        }
    }

    const chatBtn = document.getElementById('profileChatBtn');
    if (chatBtn) {
        chatBtn.addEventListener('click', () => {
            document.getElementById('empresaProfileScreen').style.display = 'none';
            openChatIndividual(empresaId, empresa.nomeEmpresa);
        });
    }

    const reportBtn = document.getElementById('profileReportBtn');
    if (reportBtn) {
        reportBtn.addEventListener('click', () => {
            reportContent('perfil', empresaId, empresa.nomeEmpresa);
        });
    }

    document.querySelectorAll('.publicacao-card').forEach(card => {
        card.addEventListener('click', () => {
            openPublicacaoDetalhes(card.dataset.pubId);
        });
    });
}

async function seguirEmpresa(empresaId) {
    if (!currentUser || currentUserType !== 'cliente') return;

    await db.ref(`seguindo/${currentUser.uid}/${empresaId}`).set(true);
    await db.ref(`seguidores/${empresaId}/${currentUser.uid}`).set(true);

    const seguidoresSnap = await db.ref(`seguidores/${empresaId}`).once('value');
    const count = seguidoresSnap.numChildren();
    await db.ref(`empresas/${empresaId}`).update({ seguidoresCount: count });

    showToast('Agora você segue esta empresa!');
    renderFeed();
}

async function deixarSeguir(empresaId) {
    if (!currentUser) return;

    await db.ref(`seguindo/${currentUser.uid}/${empresaId}`).remove();
    await db.ref(`seguidores/${empresaId}/${currentUser.uid}`).remove();

    const seguidoresSnap = await db.ref(`seguidores/${empresaId}`).once('value');
    const count = seguidoresSnap.numChildren();
    await db.ref(`empresas/${empresaId}`).update({ seguidoresCount: count });

    showToast('Você deixou de seguir esta empresa');
    renderFeed();
}

// ==================== CHATS ====================

async function renderChats() {
    const main = document.getElementById('mainContent');
    if (!main) return;

    main.innerHTML = `
        <div class="header">
            <h2><i class="fas fa-comment-dots" style="color: #D4AF37;"></i> Chats</h2>
            ${currentUserType === 'empresa' ? '<button id="btnIniciarChat" class="badge-gold" style="border: none;"><i class="fas fa-plus"></i> Iniciar</button>' : ''}
        </div>
        <div id="chatsList"></div>
    `;

    if (currentUserType === 'empresa') {
        document.getElementById('btnIniciarChat')?.addEventListener('click', showIniciarChatModal);
    }

    const chatsSnapshot = await db.ref('chats').once('value');
    const chats = [];

    for (const [key, chat] of Object.entries(chatsSnapshot.val() || {})) {
        if (chat.participantes && chat.participantes.includes(currentUser.uid)) {
            const outroId = chat.participantes.find(p => p !== currentUser.uid);
            let nome = '';
            if (outroId) {
                const empresaSnap = await db.ref(`empresas/${outroId}`).once('value');
                const clienteSnap = await db.ref(`clientes/${outroId}`).once('value');
                if (empresaSnap.exists()) nome = empresaSnap.val().nomeEmpresa;
                else if (clienteSnap.exists()) nome = clienteSnap.val().nome;
                else nome = 'Usuário';
            }

            const mensagens = chat.mensagens || {};
            const unreadCount = Object.values(mensagens).filter(m => m.para === currentUser.uid && !m.lida).length;

            chats.push({ id: key, ...chat, outroId, nome, unreadCount });
        }
    }

    chats.sort((a, b) => (b.ultimaAtualizacao || 0) - (a.ultimaAtualizacao || 0));

    const container = document.getElementById('chatsList');

    if (chats.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-comments fa-3x mb-3"></i><p>Nenhuma conversa ainda</p><p class="small">Inicie uma conversa respondendo um story ou negociando um produto!</p></div>';
        return;
    }

    let htmlContent = '';
    for (const chat of chats) {
        const isStoryReply = chat.ultimaMensagem && chat.ultimaMensagem.includes('Respondeu a um story');
        htmlContent += `
            <div class="chat-list-item" data-chat-id="${chat.id}" data-outro-id="${chat.outroId || ''}" data-nome="${escapeHtml(chat.nome)}">
                <div class="chat-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="chat-info">
                    <div class="chat-name">${escapeHtml(chat.nome)}</div>
                    <div class="chat-last-msg">
                        ${isStoryReply ? '<i class="fas fa-circle" style="color: #D4AF37; font-size: 8px;"></i>' : ''}
                        ${escapeHtml(chat.ultimaMensagem || 'Nova conversa')}
                    </div>
                </div>
                <div class="chat-time">${formatDate(chat.ultimaAtualizacao)}</div>
                ${chat.unreadCount > 0 ? `<div class="chat-unread">${chat.unreadCount}</div>` : ''}
            </div>
        `;
    }
    container.innerHTML = htmlContent;

    document.querySelectorAll('.chat-list-item').forEach(el => {
        el.addEventListener('click', () => {
            const chatId = el.dataset.chatId;
            const outroId = el.dataset.outroId;
            const nome = el.dataset.nome;
            openChatIndividualById(chatId, outroId, nome);
        });
    });
}

async function showIniciarChatModal() {
    await loadSeguidores();

    if (seguidoresIds.length === 0) {
        showToast('Você não tem seguidores para conversar', 'error');
        return;
    }

    const seguidoresComNomes = [];
    for (const uid of seguidoresIds) {
        const clienteSnap = await db.ref(`clientes/${uid}`).once('value');
        const nome = clienteSnap.exists() ? clienteSnap.val().nome : uid;
        seguidoresComNomes.push({ uid, nome });
    }

    const { value: selectedUid } = await Swal.fire({
        title: 'Iniciar conversa',
        html: `
            <select id="seletorSeguidor" class="swal2-select" style="width: 100%; padding: 10px;">
                <option value="">Selecione um seguidor</option>
                ${seguidoresComNomes.map(s => `<option value="${s.uid}">${escapeHtml(s.nome)}</option>`).join('')}
            </select>
        `,
        showCancelButton: true,
        confirmButtonText: 'Iniciar',
        confirmButtonColor: '#0A2647',
        preConfirm: () => {
            const uid = document.getElementById('seletorSeguidor').value;
            if (!uid) {
                Swal.showValidationMessage('Selecione um seguidor');
                return false;
            }
            return uid;
        }
    });

    if (selectedUid) {
        const seguidor = seguidoresComNomes.find(s => s.uid === selectedUid);
        openChatIndividual(selectedUid, seguidor.nome);
    }
}

function openChatIndividual(empresaId, nome) {
    const chatId = [currentUser.uid, empresaId].sort().join('_');
    openChatIndividualById(chatId, empresaId, nome);
}

async function openChatIndividualById(chatId, outroId, nome) {
    currentChatId = chatId;
    currentChatType = 'individual';
    currentChatNome = nome;
    currentChatDestinatarioId = outroId;

    document.getElementById('chatScreenName').innerText = nome;
    document.getElementById('chatScreen').style.display = 'flex';

    const chatRef = db.ref(`chats/${chatId}`);
    const snap = await chatRef.once('value');
    if (!snap.exists()) {
        await chatRef.set({
            participantes: [currentUser.uid, outroId],
            ultimaAtualizacao: Date.now()
        });
    }

    await loadChatMessages();
    await markMessagesAsRead(chatId);
    loadUnreadChats();
}

async function loadChatMessages() {
    if (!currentChatId) return;

    if (currentChatMessagesRef) {
        currentChatMessagesRef.off();
    }

    const messagesRef = db.ref(`chats/${currentChatId}/mensagens`);
    currentChatMessagesRef = messagesRef;

    messagesRef.on('value', async (snapshot) => {
        const messages = [];
        snapshot.forEach(child => {
            messages.push({ id: child.key, ...child.val() });
        });
        messages.sort((a, b) => (a.data || 0) - (b.data || 0));

        const container = document.getElementById('chatMessagesList');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-5">Nenhuma mensagem. Envie algo para começar!</div>';
            return;
        }

        let htmlContent = '';
        for (const msg of messages) {
            const isSent = msg.de === currentUser.uid;
            htmlContent += `
                <div class="chat-message ${isSent ? 'sent' : 'received'}">
                    ${!isSent && msg.isRespostaStory ? `<div class="story-reply-badge" style="font-size: 10px; margin-bottom: 4px;"><i class="fas fa-circle" style="color: #D4AF37; font-size: 8px;"></i> Respondeu a um story</div>` : ''}
                    ${escapeHtml(msg.texto)}
                    <div style="font-size: 10px; margin-top: 4px; opacity: 0.7;">${formatDate(msg.data)}</div>
                </div>
            `;
        }
        container.innerHTML = htmlContent;
        container.scrollTop = container.scrollHeight;
    });
}

// ==================== GRUPOS ====================

async function renderGrupos() {
    const main = document.getElementById('mainContent');
    if (!main) return;

    const gruposSnapshot = await db.ref('grupos').once('value');
    const grupos = [];

    for (const [key, grupo] of Object.entries(gruposSnapshot.val() || {})) {
        if (grupo.membros && grupo.membros[currentUser.uid]) {
            grupos.push({ id: key, ...grupo });
        }
    }

    main.innerHTML = `
        <div class="header">
            <h2><i class="fas fa-users" style="color: #D4AF37;"></i> Grupos</h2>
            ${currentUserType === 'empresa' ? '<button id="btnCriarGrupo" class="badge-gold" style="border: none;"><i class="fas fa-plus"></i> Criar Grupo</button>' : ''}
        </div>
        <div id="gruposList"></div>
    `;

    if (currentUserType === 'empresa') {
        document.getElementById('btnCriarGrupo')?.addEventListener('click', showCriarGrupoModal);
    }

    const container = document.getElementById('gruposList');

    if (grupos.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users fa-3x mb-3"></i><p>Nenhum grupo ainda</p><p class="small">Empresas podem criar grupos para seus seguidores</p></div>';
        return;
    }

    let htmlContent = '';
    for (const grupo of grupos) {
        const membrosCount = grupo.membros ? Object.keys(grupo.membros).length : 0;
        htmlContent += `
            <div class="grupo-card" data-grupo-id="${grupo.id}" data-grupo-nome="${escapeHtml(grupo.nome)}">
                <div class="grupo-avatar">
                    <i class="fas fa-users"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 700;">${escapeHtml(grupo.nome)}</div>
                    <div class="small text-muted">${membrosCount} membros</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #94A3B8;"></i>
            </div>
        `;
    }
    container.innerHTML = htmlContent;

    document.querySelectorAll('.grupo-card').forEach(card => {
        card.addEventListener('click', () => {
            const grupoId = card.dataset.grupoId;
            const grupoNome = card.dataset.grupoNome;
            openGrupoChat(grupoId, grupoNome);
        });
    });
}

async function showCriarGrupoModal() {
    await loadSeguidores();

    if (seguidoresIds.length === 0) {
        showToast('Você precisa ter seguidores para criar um grupo', 'error');
        return;
    }

    const seguidoresComNomes = [];
    for (const uid of seguidoresIds) {
        const clienteSnap = await db.ref(`clientes/${uid}`).once('value');
        const nome = clienteSnap.exists() ? clienteSnap.val().nome : uid;
        seguidoresComNomes.push({ uid, nome });
    }

    const { value: formValues } = await Swal.fire({
        title: 'Criar Grupo',
        html: `
            <input id="grupoNome" class="swal2-input" placeholder="Nome do grupo *">
            <select id="grupoMembros" class="swal2-select" multiple size="5">
                ${seguidoresComNomes.map(s => `<option value="${s.uid}">${escapeHtml(s.nome)}</option>`).join('')}
            </select>
            <p class="small text-muted mt-2">Selecione os seguidores para adicionar (pressione Ctrl para múltiplos)</p>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Criar Grupo',
        confirmButtonColor: '#0A2647',
        preConfirm: () => {
            const nome = document.getElementById('grupoNome').value.trim();
            if (!nome) {
                Swal.showValidationMessage('Nome do grupo é obrigatório');
                return false;
            }
            const membrosSelect = document.getElementById('grupoMembros');
            const membros = Array.from(membrosSelect.selectedOptions).map(opt => opt.value);
            membros.push(currentUser.uid);
            return { nome, membros };
        }
    });

    if (formValues) {
        const grupoRef = db.ref('grupos').push();
        const membrosObj = {};
        formValues.membros.forEach(uid => { membrosObj[uid] = true; });

        await grupoRef.set({
            nome: formValues.nome,
            criadorId: currentUser.uid,
            dataCriacao: Date.now(),
            membros: membrosObj
        });

        const nomesMembros = await Promise.all(formValues.membros.map(async (uid) => {
            return await getUserName(uid);
        }));
        const mensagem = `${currentUserData?.nomeEmpresa || currentUser.displayName} criou o grupo "${formValues.nome}" e adicionou: ${nomesMembros.join(', ')}`;
        await sendSystemMessage(grupoRef.key, mensagem);

        showToast('Grupo criado com sucesso!');
        renderGrupos();
    }
}

async function openGrupoChat(grupoId, grupoNome) {
    currentGrupoId = grupoId;
    currentChatType = 'grupo';
    currentChatNome = grupoNome;

    document.getElementById('grupoChatName').innerText = grupoNome;
    document.getElementById('grupoChatScreen').style.display = 'flex';

    await loadGrupoMessages();
}

async function loadGrupoMessages() {
    if (!currentGrupoId) return;

    if (currentGrupoMessagesRef) {
        currentGrupoMessagesRef.off();
    }

    const messagesRef = db.ref(`gruposMensagens/${currentGrupoId}`);
    currentGrupoMessagesRef = messagesRef;

    messagesRef.on('value', async (snapshot) => {
        const messages = [];
        snapshot.forEach(child => {
            messages.push({ id: child.key, ...child.val() });
        });
        messages.sort((a, b) => (a.data || 0) - (b.data || 0));

        const container = document.getElementById('grupoChatMessagesList');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-5">Nenhuma mensagem ainda</div>';
            return;
        }

        let htmlContent = '';
        for (const msg of messages) {
            if (msg.isSystem) {
                htmlContent += `
                    <div class="chat-message system" style="background: #F1F5F9; color: #64748B; text-align: center; max-width: 90%; margin: 8px auto;">
                        <i class="fas fa-info-circle"></i> ${escapeHtml(msg.texto)}
                        <div style="font-size: 9px; margin-top: 4px;">${formatDate(msg.data)}</div>
                    </div>
                `;
            } else {
                const isSent = msg.de === currentUser.uid;
                let nomeRemetente = '';
                if (msg.de && msg.de !== 'system') {
                    const empresaSnap = await db.ref(`empresas/${msg.de}`).once('value');
                    const clienteSnap = await db.ref(`clientes/${msg.de}`).once('value');
                    if (empresaSnap.exists()) nomeRemetente = empresaSnap.val().nomeEmpresa;
                    else if (clienteSnap.exists()) nomeRemetente = clienteSnap.val().nome;
                    else nomeRemetente = 'Usuário';
                }

                htmlContent += `
                    <div class="chat-message ${isSent ? 'sent' : 'received'}" style="${!isSent ? 'margin-bottom: 4px;' : ''}">
                        ${!isSent ? `<div style="font-size: 11px; font-weight: 600; margin-bottom: 6px;">${escapeHtml(nomeRemetente)}</div>` : ''}
                        ${escapeHtml(msg.texto)}
                        <div style="font-size: 10px; margin-top: 6px; opacity: 0.7;">${formatDate(msg.data)}</div>
                    </div>
                `;
            }
        }
        container.innerHTML = htmlContent;
        container.scrollTop = container.scrollHeight;
    });
}

async function showGrupoInfo() {
    if (!currentGrupoId) return;

    const grupoSnap = await db.ref(`grupos/${currentGrupoId}`).once('value');
    const grupo = grupoSnap.val();
    if (!grupo) return;

    const membros = grupo.membros || {};
    const membrosIds = Object.keys(membros);

    let membrosHtml = '';
    for (const uid of membrosIds) {
        let nome = uid;
        const empresaSnap = await db.ref(`empresas/${uid}`).once('value');
        const clienteSnap = await db.ref(`clientes/${uid}`).once('value');
        if (empresaSnap.exists()) nome = empresaSnap.val().nomeEmpresa;
        else if (clienteSnap.exists()) nome = clienteSnap.val().nome;

        membrosHtml += `
            <div class="membro-item">
                <div><i class="fas fa-user-circle me-2"></i> ${escapeHtml(nome)}</div>
                ${currentUser.uid === grupo.criadorId && uid !== currentUser.uid ? `
                    <button class="btn-remover-membro-info" data-uid="${uid}" style="background: #DC2626; border: none; color: white; cursor: pointer; padding: 4px 12px; border-radius: 20px; font-size: 11px;">
                        <i class="fas fa-user-minus"></i> Remover
                    </button>
                ` : ''}
            </div>
        `;
    }

    const result = await Swal.fire({
        title: `Informações do Grupo: ${grupo.nome}`,
        html: `
            <div style="text-align: left;">
                <p><strong>Criado por:</strong> ${grupo.criadorId === currentUser.uid ? 'Você' : await getUserName(grupo.criadorId)}</p>
                <p><strong>Membros (${membrosIds.length}):</strong></p>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${membrosHtml}
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Fechar',
        cancelButtonText: currentUser.uid === grupo.criadorId ? 'Gerenciar Membros' : undefined
    });

    if (result.dismiss === Swal.DismissReason.cancel && currentUser.uid === grupo.criadorId) {
        openGerenciarMembrosScreen(currentGrupoId);
    }

    document.querySelectorAll('.btn-remover-membro-info').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            const nome = await getUserName(uid);
            const confirmResult = await Swal.fire({
                title: 'Remover membro?',
                text: `Tem certeza que deseja remover ${nome} do grupo?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#DC2626',
                confirmButtonText: 'Sim, remover'
            });
            if (confirmResult.isConfirmed) {
                const novosMembros = { ...membros };
                delete novosMembros[uid];
                await db.ref(`grupos/${currentGrupoId}`).update({ membros: novosMembros });

                await sendSystemMessage(currentGrupoId, `${nome} foi removido do grupo por ${await getUserName(currentUser.uid)}`);

                showToast('Membro removido');
                showGrupoInfo();
                if (uid === currentUser.uid) {
                    document.getElementById('grupoChatScreen').style.display = 'none';
                    renderGrupos();
                }
            }
        });
    });
}

async function openGerenciarMembrosScreen(grupoId) {
    currentGrupoId = grupoId;

    const grupoSnap = await db.ref(`grupos/${grupoId}`).once('value');
    const grupo = grupoSnap.val();
    if (!grupo) return;

    document.getElementById('gerenciarMembrosTitle').innerHTML = `Gerenciar Membros - ${escapeHtml(grupo.nome)}`;
    document.getElementById('gerenciarMembrosScreen').style.display = 'flex';

    await loadSeguidores();

    const membros = grupo.membros || {};
    const membrosIds = Object.keys(membros);

    const membrosContainer = document.getElementById('membrosListContainer');
    let membrosHtmlContent = '<h5>Membros Atuais</h5>';

    for (const uid of membrosIds) {
        let nome = uid;
        const empresaSnap = await db.ref(`empresas/${uid}`).once('value');
        const clienteSnap = await db.ref(`clientes/${uid}`).once('value');
        if (empresaSnap.exists()) nome = empresaSnap.val().nomeEmpresa;
        else if (clienteSnap.exists()) nome = clienteSnap.val().nome;

        membrosHtmlContent += `
            <div class="membro-item">
                <div><i class="fas fa-user-circle me-2"></i> ${escapeHtml(nome)}</div>
                ${uid !== currentUser.uid ? `
                    <button class="btn-remover-membro-screen" data-uid="${uid}" style="background: #DC2626; border: none; color: white; cursor: pointer; padding: 4px 12px; border-radius: 20px; font-size: 11px;">
                        <i class="fas fa-user-minus"></i> Remover
                    </button>
                ` : '<span class="text-muted">(Você)</span>'}
            </div>
        `;
    }
    membrosContainer.innerHTML = membrosHtmlContent;

    const seguidoresDisponiveis = seguidoresIds.filter(uid => !membrosIds.includes(uid));
    const addSection = document.getElementById('addMembroSection');
    const selectNovo = document.getElementById('selectNovoMembro');

    if (seguidoresDisponiveis.length > 0 && currentUser.uid === grupo.criadorId) {
        addSection.style.display = 'block';

        let optionsHtml = '<option value="">Selecione um seguidor...</option>';
        for (const uid of seguidoresDisponiveis) {
            const nome = await getUserName(uid);
            optionsHtml += `<option value="${uid}">${escapeHtml(nome)}</option>`;
        }
        selectNovo.innerHTML = optionsHtml;
    } else {
        addSection.style.display = 'none';
    }

    document.querySelectorAll('.btn-remover-membro-screen').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            const nome = await getUserName(uid);
            const result = await Swal.fire({
                title: 'Remover membro?',
                text: `Tem certeza que deseja remover ${nome} do grupo?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#DC2626',
                confirmButtonText: 'Sim, remover'
            });
            if (result.isConfirmed) {
                const novosMembros = { ...membros };
                delete novosMembros[uid];
                await db.ref(`grupos/${grupoId}`).update({ membros: novosMembros });

                await sendSystemMessage(grupoId, `${nome} foi removido do grupo por ${await getUserName(currentUser.uid)}`);

                showToast('Membro removido');
                openGerenciarMembrosScreen(grupoId);

                if (uid === currentUser.uid) {
                    document.getElementById('gerenciarMembrosScreen').style.display = 'none';
                    document.getElementById('grupoChatScreen').style.display = 'none';
                    renderGrupos();
                }
            }
        });
    });

    const addBtn = document.getElementById('btnAddMembro');
    if (addBtn) {
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
        newAddBtn.addEventListener('click', async () => {
            const uid = selectNovo.value;
            if (!uid) {
                showToast('Selecione um seguidor', 'error');
                return;
            }

            const novosMembros = { ...membros };
            novosMembros[uid] = true;
            await db.ref(`grupos/${grupoId}`).update({ membros: novosMembros });

            const nome = await getUserName(uid);
            await sendSystemMessage(grupoId, `${nome} foi adicionado ao grupo por ${await getUserName(currentUser.uid)}`);

            showToast('Membro adicionado!');
            openGerenciarMembrosScreen(grupoId);
        });
    }
}

// ==================== DASHBOARD ====================

async function renderDashboard() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    
    await carregarMeusPedidos();

    if (currentUserType === 'cliente') {
        // Dashboard para CLIENTE
        const pedidosPendentes = allMeusPedidos.filter(p => p.status === 'pendente');
        const pedidosEntregues = allMeusPedidos.filter(p => p.status === 'entregue');
        const totalGasto = pedidosEntregues.reduce((sum, p) => sum + p.total, 0);
        
        const loyalty = await getLoyaltyInfo();

        main.innerHTML = `
            <div class="dashboard-cliente">
                <div class="header">
                    <h2><i class="fas fa-chart-line" style="color: #D4AF37;"></i> Meu Dashboard</h2>
                    <button id="loyaltyDashboardBtn" class="badge-gold" style="border: none;">
                        <i class="fas fa-crown"></i> ${loyalty.pontos} pts
                    </button>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card" onclick="setActiveNav('pedidos')">
                        <div class="stat-number">${allMeusPedidos.length}</div>
                        <div class="stat-label">Total Pedidos</div>
                    </div>
                    <div class="stat-card" onclick="setActiveNav('pedidos')">
                        <div class="stat-number">${pedidosPendentes.length}</div>
                        <div class="stat-label">Em Andamento</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${formatNumber(totalGasto)} KZ</div>
                        <div class="stat-label">Total Gasto</div>
                    </div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card" id="loyaltyPointsCard">
                        <div class="stat-number">${loyalty.nivel}</div>
                        <div class="stat-label">Nível Fidelidade</div>
                    </div>
                    <div class="stat-card" onclick="setActiveNav('pedidos')">
                        <div class="stat-number">${pedidosEntregues.length}</div>
                        <div class="stat-label">Pedidos Entregues</div>
                    </div>
                    <div class="stat-card" onclick="openCuponsScreen()">
                        <div class="stat-number">🎫</div>
                        <div class="stat-label">Cupons</div>
                    </div>
                </div>
                
                <div class="bg-white rounded-3 p-4 mt-3">
                    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                        <h6 class="fw-bold m-0"><i class="fas fa-clock me-2" style="color: #F59E0B;"></i>Meus Pedidos Recentes</h6>
                        <button id="verTodosPedidosBtn" class="badge-gold" style="border: none; background: #0A2647; color: white; padding: 6px 16px;">
                            <i class="fas fa-eye"></i> Ver todos
                        </button>
                    </div>
                    <div id="pedidosRecentes"></div>
                </div>
            </div>
        `;
        
        document.getElementById('loyaltyDashboardBtn')?.addEventListener('click', showLoyaltyModal);
        document.getElementById('loyaltyPointsCard')?.addEventListener('click', showLoyaltyModal);
        document.getElementById('verTodosPedidosBtn')?.addEventListener('click', () => setActiveNav('pedidos'));
        
        const container = document.getElementById('pedidosRecentes');
        if (allMeusPedidos.length === 0) {
            container.innerHTML = '<div class="text-muted text-center py-3">Nenhum pedido realizado</div>';
        } else {
            let html = '';
            for (const pedido of allMeusPedidos.slice(0, 5)) {
                html += `
                    <div class="border-bottom py-2">
                        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <div>
                                <div class="fw-bold">Pedido #${pedido.id.substring(0, 8)}</div>
                                <div class="small text-muted">${pedido.itens.length} item(ns)</div>
                            </div>
                            <div class="text-end">
                                <div class="fw-bold text-warning">${formatNumber(pedido.total)} KZ</div>
                                <span class="status-pedido ${getStatusClass(pedido.status)}" style="font-size: 10px;">${getStatusText(pedido.status)}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html;
        }
        return;
    }

    // Dashboard para EMPRESA
    const minhasPublicacoes = allPublicacoes.filter(p => p.empresaId === currentUser.uid);
    const meusStorys = allStorys.filter(s => s.empresaId === currentUser.uid);
    const totalViews = meusStorys.reduce((sum, s) => sum + Object.keys(s.visualizadoPor || {}).length, 0);
    const totalLikes = minhasPublicacoes.reduce((sum, p) => sum + (p.curtidasCount || 0), 0);
    
    const pedidosSnap = await db.ref('pedidos').once('value');
    const meusPedidos = [];
    pedidosSnap.forEach(child => { 
        const pedido = child.val(); 
        if (pedido && pedido.itens && pedido.itens.some(i => i.empresaId === currentUser.uid)) {
            meusPedidos.push({ id: child.key, ...pedido });
        }
    });
    
    const totalVendas = meusPedidos.filter(p => p.status === 'entregue').reduce((sum, p) => sum + p.total, 0);
    const pedidosPendentes = meusPedidos.filter(p => p.status === 'pendente');
    const pedidosEmAndamento = meusPedidos.filter(p => ['confirmado', 'preparando', 'enviado'].includes(p.status));
    
    const seguidoresSnap = await db.ref(`seguidores/${currentUser.uid}`).once('value');

    main.innerHTML = `
        <div class="dashboard-empresa">
            <div class="header">
                <h2><i class="fas fa-chart-line" style="color: #D4AF37;"></i> Dashboard Empresarial</h2>
                <button id="btnCupons" class="badge-gold" style="border: none;">
                    <i class="fas fa-ticket-alt"></i> Gerenciar Cupons
                </button>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card" onclick="setActiveNav('publicar')">
                    <div class="stat-number">${minhasPublicacoes.length}</div>
                    <div class="stat-label">Publicações</div>
                </div>
                <div class="stat-card" onclick="showNovoStoryModal()">
                    <div class="stat-number">${meusStorys.length}</div>
                    <div class="stat-label">Storys</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${seguidoresSnap.numChildren()}</div>
                    <div class="stat-label">Seguidores</div>
                </div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${totalViews}</div>
                    <div class="stat-label">Visualizações</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalLikes}</div>
                    <div class="stat-label">Curtidas</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${formatNumber(totalVendas)} KZ</div>
                    <div class="stat-label">Vendas</div>
                </div>
            </div>
            
            <div class="bg-white rounded-3 p-4 mb-3">
                <h6 class="fw-bold mb-3"><i class="fas fa-clock me-2" style="color: #F59E0B;"></i>Pedidos Pendentes (${pedidosPendentes.length})</h6>
                <div id="pedidosPendentesLista"></div>
            </div>
            
            <div class="bg-white rounded-3 p-4 mb-3">
                <h6 class="fw-bold mb-3"><i class="fas fa-spinner me-2" style="color: #3B82F6;"></i>Pedidos em Andamento (${pedidosEmAndamento.length})</h6>
                <div id="pedidosAndamentoLista"></div>
            </div>
            
            <div class="bg-white rounded-3 p-4">
                <h6 class="fw-bold mb-3"><i class="fas fa-chart-simple me-2" style="color: #D4AF37;"></i>Publicações Mais Curtidas</h6>
                <div id="topPublicacoes"></div>
            </div>
        </div>
    `;
    
    document.getElementById('btnCupons')?.addEventListener('click', () => {
        openCuponsScreen();
    });
    
    const pendentesDiv = document.getElementById('pedidosPendentesLista');
    if (pedidosPendentes.length === 0) {
        pendentesDiv.innerHTML = '<div class="text-muted text-center py-3">Nenhum pedido pendente</div>';
    } else {
        let html = '';
        for (const pedido of pedidosPendentes) {
            html += `
                <div class="border rounded-3 p-3 mb-2">
                    <div class="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
                        <div>
                            <div class="fw-bold">${escapeHtml(pedido.clienteNome)}</div>
                            <div class="small text-muted">${formatDate(pedido.data)}</div>
                        </div>
                        <span class="status-pedido status-pendente px-2 py-1 rounded" style="background: #FEF3C7; color: #D97706;">Pendente</span>
                    </div>
                    <div class="small mb-2">
                        <strong>Itens:</strong> ${pedido.itens.filter(i => i.empresaId === currentUser.uid).map(i => `${i.quantidade}x ${i.titulo}`).join(', ')}
                    </div>
                    <div class="fw-bold text-warning mb-2">Total: ${formatNumber(pedido.total)} KZ</div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn-aceitar-pedido btn-sm" data-id="${pedido.id}" style="background: #10B981; color: white; border: none; border-radius: 8px; padding: 6px 16px;">
                            <i class="fas fa-check me-1"></i> Aceitar
                        </button>
                        <button class="btn-rejeitar-pedido btn-sm" data-id="${pedido.id}" style="background: #EF4444; color: white; border: none; border-radius: 8px; padding: 6px 16px;">
                            <i class="fas fa-times me-1"></i> Rejeitar
                        </button>
                    </div>
                </div>
            `;
        }
        pendentesDiv.innerHTML = html;
        
        document.querySelectorAll('.btn-aceitar-pedido').forEach(btn => { 
            btn.addEventListener('click', async () => { 
                await atualizarStatusPedido(btn.dataset.id, 'confirmado'); 
                renderDashboard(); 
            }); 
        });
        
        document.querySelectorAll('.btn-rejeitar-pedido').forEach(btn => { 
            btn.addEventListener('click', async () => { 
                const { value: motivo } = await Swal.fire({ 
                    title: 'Motivo da rejeição', 
                    input: 'textarea', 
                    inputPlaceholder: 'Digite o motivo...',
                    confirmButtonText: 'Enviar',
                    confirmButtonColor: '#DC2626'
                }); 
                if (motivo) await atualizarStatusPedido(btn.dataset.id, 'rejeitado', motivo); 
                renderDashboard(); 
            }); 
        });
    }
    
    const andamentoDiv = document.getElementById('pedidosAndamentoLista');
    if (pedidosEmAndamento.length === 0) {
        andamentoDiv.innerHTML = '<div class="text-muted text-center py-3">Nenhum pedido em andamento</div>';
    } else {
        let html = '';
        for (const pedido of pedidosEmAndamento) {
            html += `
                <div class="border rounded-3 p-3 mb-2">
                    <div class="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
                        <div>
                            <div class="fw-bold">${escapeHtml(pedido.clienteNome)}</div>
                            <div class="small text-muted">${formatDate(pedido.data)}</div>
                        </div>
                        <span class="status-pedido" style="
                            ${pedido.status === 'confirmado' ? 'background: #D1FAE5; color: #059669; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 600;' : ''}
                            ${pedido.status === 'preparando' ? 'background: #DBEAFE; color: #2563EB; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 600;' : ''}
                            ${pedido.status === 'enviado' ? 'background: #E0E7FF; color: #4338CA; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 600;' : ''}
                        ">${getStatusText(pedido.status)}</span>
                    </div>
                    <div class="small mb-2">
                        <strong>Itens:</strong> ${pedido.itens.filter(i => i.empresaId === currentUser.uid).map(i => `${i.quantidade}x ${i.titulo}`).join(', ')}
                    </div>
                    <div class="fw-bold text-warning mb-2">Total: ${formatNumber(pedido.total)} KZ</div>
                    <div class="d-flex gap-2 flex-wrap">
                        ${pedido.status === 'confirmado' ? `<button class="btn-preparando-pedido btn-sm" data-id="${pedido.id}" style="background: #0A2647; color: white; border: none; border-radius: 8px; padding: 6px 16px;"><i class="fas fa-utensils me-1"></i> Preparando</button>` : ''}
                        ${pedido.status === 'preparando' ? `<button class="btn-enviar-pedido btn-sm" data-id="${pedido.id}" style="background: #0A2647; color: white; border: none; border-radius: 8px; padding: 6px 16px;"><i class="fas fa-truck me-1"></i> Enviar</button>` : ''}
                        ${pedido.status === 'enviado' ? `<button class="btn-concluir-pedido btn-sm" data-id="${pedido.id}" style="background: #10B981; color: white; border: none; border-radius: 8px; padding: 6px 16px;"><i class="fas fa-check-double me-1"></i> Concluir Entrega</button>` : ''}
                    </div>
                </div>
            `;
        }
        andamentoDiv.innerHTML = html;
        
        document.querySelectorAll('.btn-preparando-pedido').forEach(btn => { 
            btn.addEventListener('click', async () => { 
                await atualizarStatusPedido(btn.dataset.id, 'preparando'); 
                renderDashboard(); 
            }); 
        });
        document.querySelectorAll('.btn-enviar-pedido').forEach(btn => { 
            btn.addEventListener('click', async () => { 
                await atualizarStatusPedido(btn.dataset.id, 'enviado'); 
                renderDashboard(); 
            }); 
        });
        document.querySelectorAll('.btn-concluir-pedido').forEach(btn => { 
            btn.addEventListener('click', async () => { 
                await atualizarStatusPedido(btn.dataset.id, 'entregue'); 
                renderDashboard(); 
            }); 
        });
    }
    
    const topPublicacoes = [...minhasPublicacoes].sort((a, b) => (b.curtidasCount || 0) - (a.curtidasCount || 0)).slice(0, 5);
    document.getElementById('topPublicacoes').innerHTML = topPublicacoes.length === 0 
        ? '<div class="text-muted text-center py-3">Nenhuma publicação</div>' 
        : topPublicacoes.map(pub => `
            <div class="d-flex justify-content-between align-items-center border-bottom py-2 flex-wrap gap-2">
                <div class="fw-bold small">${escapeHtml(pub.titulo)}</div>
                <div><i class="fas fa-heart text-danger"></i> ${pub.curtidasCount || 0}</div>
            </div>
        `).join('');
}

// ==================== TORNAR-SE EMPRESA ====================

async function showTornarEmpresaWizard() {
    const { value: formValues } = await Swal.fire({
        title: 'Tornar-se Empresa',
        html: `
            <input id="empNome" class="swal2-input" placeholder="Nome da empresa *">
            <textarea id="empDesc" class="swal2-textarea" placeholder="Descrição do negócio"></textarea>
            <input id="empTelefone" class="swal2-input" placeholder="Telefone">
            <input id="empEndereco" class="swal2-input" placeholder="Endereço">
            <input id="empFacebook" class="swal2-input" placeholder="Facebook (opcional)">
            <input id="empInstagram" class="swal2-input" placeholder="Instagram (opcional)">
            <select id="empCategoria" class="swal2-select">
                <option value="">Selecione a categoria</option>
                <option value="alimentacao">Alimentação</option>
                <option value="moda">Moda</option>
                <option value="tecnologia">Tecnologia</option>
                <option value="servicos">Serviços</option>
                <option value="construcao">Construção</option>
                <option value="outros">Outros</option>
            </select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        confirmButtonColor: '#0A2647',
        preConfirm: () => {
            const nome = document.getElementById('empNome').value;
            if (!nome) {
                Swal.showValidationMessage('Nome da empresa é obrigatório');
                return false;
            }
            return {
                nome: nome,
                descricao: document.getElementById('empDesc').value,
                telefone: document.getElementById('empTelefone').value,
                endereco: document.getElementById('empEndereco').value,
                facebook: document.getElementById('empFacebook').value,
                instagram: document.getElementById('empInstagram').value,
                categoria: document.getElementById('empCategoria').value
            };
        }
    });

    if (formValues) {
        await db.ref(`empresas/${currentUser.uid}`).set({
            uid: currentUser.uid,
            tipo: 'empresa',
            nomeEmpresa: formValues.nome,
            descricao: formValues.descricao,
            telefone: formValues.telefone,
            endereco: formValues.endereco,
            facebook: formValues.facebook,
            instagram: formValues.instagram,
            categoria: formValues.categoria,
            email: currentUser.email,
            dataCadastro: Date.now(),
            status: 'ativo',
            seguidoresCount: 0,
            visualizacoesStorys: 0
        });

        await currentUser.updateProfile({ displayName: formValues.nome });
        currentUserType = 'empresa';
        currentUserData = { nomeEmpresa: formValues.nome };

        showToast('Parabéns! Agora você é uma empresa!');
        updatePublishButton();
        setActiveNav('feed');
        renderPerfil();
    }
}

// ==================== SISTEMA DE AJUDA FOCOJÁ ====================
// Adicione este código no final do seu script.js

// ==================== FAQ COMPLETO (30 PERGUNTAS) ====================

const faqData = [
    {
        id: 1,
        pergunta: "📝 Como criar uma conta no FocoJá?",
        resposta: "Clique em 'Cadastre-se' na página inicial. Escolha entre conta de Cliente ou Empresa. Preencha seus dados básicos (nome, email, telefone) e crie uma senha. O cadastro é gratuito e leva menos de 2 minutos!"
    },
    {
        id: 2,
        pergunta: "🏪 Como uma empresa pode se cadastrar?",
        resposta: "No cadastro, selecione 'Sou Empresa'. Preencha: nome da empresa, NUIT, descrição, categoria, endereço completo, telefone e redes sociais. Após aprovação, você já pode publicar produtos e criar cupons!"
    },
    {
        id: 3,
        pergunta: "👤 Como um cliente se cadastra?",
        resposta: "Selecione 'Sou Cliente' no cadastro. Informe: nome completo, data de nascimento, gênero, telefone, província, email e senha. Pronto! Você já pode seguir empresas e comprar produtos."
    },
    {
        id: 4,
        pergunta: "📦 Como publicar um produto/serviço?",
        resposta: "Acesse a aba 'Publicar' (disponível apenas para empresas). Preencha: título, descrição, preço, categoria e faça upload de até 3 imagens (máx 300KB cada). Clique em 'Publicar' e seu produto estará na vitrine!"
    },
    {
        id: 5,
        pergunta: "🛒 Como comprar um produto?",
        resposta: "No Feed, encontre o produto desejado e clique em 'Comprar'. O item vai para o carrinho. Finalize a compra informando seu endereço de entrega. Você pode aplicar cupons de desconto antes de finalizar."
    },
    {
        id: 6,
        pergunta: "💬 Como negociar com um vendedor?",
        resposta: "Clique em 'Negociar' na publicação do produto. Isso abrirá um chat direto com a empresa. Você pode perguntar sobre preços, estoque, condições de pagamento e entrega."
    },
    {
        id: 7,
        pergunta: "🎟️ Como criar um cupom de desconto?",
        resposta: "Acesse Dashboard > Gerenciar Cupons (ícone +). Defina: nome do cupom, código (ou gere automático), tipo de desconto (percentual ou fixo), valor, data de validade, valor mínimo da compra e limite de uso. Disponível apenas para empresas."
    },
    {
        id: 8,
        pergunta: "💰 Como aplicar um cupom na compra?",
        resposta: "No carrinho, insira o código do cupom no campo 'Código do cupom' e clique em 'Aplicar'. O desconto será calculado automaticamente. O cupom só funciona se o carrinho tiver produtos de uma única empresa."
    },
    {
        id: 9,
        pergunta: "⭐ Como funciona o programa de fidelidade?",
        resposta: "Você acumula pontos a cada compra (1 ponto a cada 100 KZ gastos). Níveis: Bronze (0-499 pts), Prata (500-999 pts - 5% off), Ouro (1000+ pts - 10% off + frete grátis). Verifique seus pontos no Perfil."
    },
    {
        id: 10,
        pergunta: "📷 O que são Stories?",
        resposta: "Stories são publicações temporárias que ficam visíveis por 24 horas. Apenas empresas podem postar stories (texto ou imagem). Clientes podem visualizar e responder aos stories via chat."
    },
    {
        id: 11,
        pergunta: "👥 Como funciona o sistema de grupos?",
        resposta: "Empresas podem criar grupos exclusivos para seus seguidores. No grupo, empresas e clientes podem interagir, compartilhar novidades e ofertas especiais. Apenas membros do grupo podem ver as mensagens."
    },
    {
        id: 12,
        pergunta: "📊 Como acompanhar meus pedidos?",
        resposta: "Acesse Perfil > Meus Pedidos. Você verá todos os seus pedidos com status: Pendente, Confirmado, Preparando, Enviado, Entregue ou Rejeitado. Clientes e empresas acompanham os pedidos em tempo real."
    },
    {
        id: 13,
        pergunta: "✅ Como atualizar o status de um pedido?",
        resposta: "Empresas: no Dashboard, vá até a seção de pedidos pendentes/em andamento. Clique em 'Aceitar', 'Preparando', 'Enviar' ou 'Concluir Entrega' para atualizar o status. O cliente recebe notificação."
    },
    {
        id: 14,
        pergunta: "🚫 Por que meu pedido foi rejeitado?",
        resposta: "A empresa pode rejeitar o pedido por: produto indisponível, problema com endereço de entrega, ou valor incorreto. Você verá o motivo da rejeição nos detalhes do pedido."
    },
    {
        id: 15,
        pergunta: "🔍 Como pesquisar empresas no Feed?",
        resposta: "Use a barra de busca no topo do Feed. Digite o nome da empresa que deseja encontrar. Você também pode filtrar empresas com stories ativos ou destaques."
    },
    {
        id: 16,
        pergunta: "❤️ Como curtir uma publicação?",
        resposta: "Clique no ícone de coração ❤️ na publicação. Sua curtida será registrada e o contador aumenta. Você pode remover a curtida clicando novamente."
    },
    {
        id: 17,
        pergunta: "💬 Como comentar em uma publicação?",
        resposta: "Clique na publicação para abrir os detalhes. Role até a seção de comentários, digite seu comentário e clique em 'Publicar'. Todos os usuários podem ver e responder comentários."
    },
    {
        id: 18,
        pergunta: "🚩 Como denunciar uma publicação ou perfil?",
        resposta: "Clique nos três pontos ⋮ no canto da publicação ou perfil. Selecione 'Denunciar' e escolha o motivo. Nossa equipe analisará a denúncia e tomará as medidas necessárias."
    },
    {
        id: 19,
        pergunta: "🔒 Esqueci minha senha. Como recuperar?",
        resposta: "Na tela de login, clique em 'Esqueceu a senha?'. Digite seu e-mail cadastrado e enviaremos um link para redefinir sua senha. Verifique sua caixa de entrada e spam."
    },
    {
        id: 20,
        pergunta: "✏️ Como editar meu perfil?",
        resposta: "Acesse Perfil > Configurações (ícone de engrenagem) ou clique no ícone de engrenagem no topo. Selecione 'Editar Perfil' para alterar nome, foto ou informações de contato."
    },
    {
        id: 21,
        pergunta: "📱 Como alternar entre várias contas?",
        resposta: "Na tela de login, você verá uma lista de contas salvas. Clique na conta desejada e digite a senha. Você também pode adicionar novas contas clicando em 'Adicionar nova conta'."
    },
    {
        id: 22,
        pergunta: "📊 O que o Dashboard mostra?",
        resposta: "Para clientes: total de pedidos, em andamento, entregues, total gasto e pontos de fidelidade. Para empresas: publicações, stories, seguidores, visualizações, curtidas, vendas e pedidos pendentes/em andamento."
    },
    {
        id: 23,
        pergunta: "🏆 Como subir de nível no programa de fidelidade?",
        resposta: "Acumule pontos comprando produtos (1 ponto a cada 100 KZ) e avaliando pedidos entregues (+50 pontos por avaliação). 500 pontos = Nível Prata (5% off). 1000 pontos = Nível Ouro (10% off + frete grátis)."
    },
    {
        id: 24,
        pergunta: "📸 Quais formatos de imagem são aceitos?",
        resposta: "Aceitamos imagens nos formatos JPG, JPEG e PNG. Tamanho máximo de 300KB por imagem. Recomendamos imagens quadradas com boa resolução para melhor visualização."
    },
    {
        id: 25,
        pergunta: "💎 Como funciona o sistema de pontos?",
        resposta: "A cada 100 KZ gastos em compras confirmadas, você ganha 1 ponto. Ao atingir níveis (Prata/Ouro), você ganha descontos automáticos nas próximas compras. Os pontos nunca expiram!"
    },
    {
        id: 26,
        pergunta: "📢 Como empresas podem engajar clientes?",
        resposta: "Use Stories diários, crie cupons exclusivos para seguidores, responda rapidamente aos chats, publique produtos de qualidade e interaja nos grupos. Quanto mais ativo, mais seguidores!"
    },
    {
        id: 27,
        pergunta: "🔔 Recebo notificações de novidades?",
        resposta: "Sim! Você recebe notificações sobre: status de pedidos, novas mensagens, respostas de stories, cupons disponíveis e promoções das empresas que você segue."
    },
    {
        id: 28,
        pergunta: "🌍 O FocoJá atende todo o país?",
        resposta: "Sim! Atendemos todas as 18 províncias de Angola: Luanda, Benguela, Huíla, Bié, Huambo, Malanje, Uíge, Zaire, Cabinda, Cunene, Cuando Cubango, Cuanza Norte, Cuanza Sul, Bengo, Icolo e Bengo, Lunda Norte, Lunda Sul, Moxico, Namibe."
    },
    {
        id: 29,
        pergunta: "💰 Quanto custa usar o FocoJá?",
        resposta: "O FocoJá é 100% GRATUITO para todos os usuários! Não cobramos taxas de cadastro, mensalidades, comissões ou qualquer outro valor. Nosso objetivo é impulsionar o comércio local angolano."
    },
    {
        id: 30,
        pergunta: "🛡️ O FocoJá é seguro?",
        resposta: "Sim! Utilizamos autenticação segura do Firebase, sistema de denúncias, moderação de conteúdo e chat monitorado. Nunca compartilhamos seus dados com terceiros. Sua segurança é nossa prioridade."
    }
];

// ==================== RESPOSTAS DO BOT ====================

const botResponses = {
    "como criar conta": faqData[0].resposta,
    "criar conta": faqData[0].resposta,
    "registrar": faqData[0].resposta,
    "cadastrar": faqData[0].resposta,
    "empresa cadastrar": faqData[1].resposta,
    "cadastro empresa": faqData[1].resposta,
    "como empresa": faqData[1].resposta,
    "cliente cadastrar": faqData[2].resposta,
    "cadastro cliente": faqData[2].resposta,
    "publicar produto": faqData[3].resposta,
    "como publicar": faqData[3].resposta,
    "vender produto": faqData[3].resposta,
    "como comprar": faqData[4].resposta,
    "comprar produto": faqData[4].resposta,
    "finalizar compra": faqData[4].resposta,
    "negociar": faqData[5].resposta,
    "conversar vendedor": faqData[5].resposta,
    "chat empresa": faqData[5].resposta,
    "criar cupom": faqData[6].resposta,
    "cupom desconto": faqData[6].resposta,
    "como criar cupom": faqData[6].resposta,
    "aplicar cupom": faqData[7].resposta,
    "usar cupom": faqData[7].resposta,
    "codigo cupom": faqData[7].resposta,
    "fidelidade": faqData[8].resposta,
    "pontos": faqData[8].resposta,
    "nivel": faqData[8].resposta,
    "story": faqData[9].resposta,
    "stories": faqData[9].resposta,
    "como postar story": faqData[9].resposta,
    "grupo": faqData[10].resposta,
    "criar grupo": faqData[10].resposta,
    "grupos": faqData[10].resposta,
    "meus pedidos": faqData[11].resposta,
    "acompanhar pedido": faqData[11].resposta,
    "status pedido": faqData[11].resposta,
    "atualizar status pedido": faqData[12].resposta,
    "mudar status": faqData[12].resposta,
    "aceitar pedido": faqData[12].resposta,
    "pedido rejeitado": faqData[13].resposta,
    "rejeitar pedido": faqData[13].resposta,
    "pesquisar empresa": faqData[14].resposta,
    "buscar empresa": faqData[14].resposta,
    "curtir": faqData[15].resposta,
    "like": faqData[15].resposta,
    "curtida": faqData[15].resposta,
    "comentar": faqData[16].resposta,
    "comentario": faqData[16].resposta,
    "denunciar": faqData[17].resposta,
    "reportar": faqData[17].resposta,
    "esqueci senha": faqData[18].resposta,
    "recuperar senha": faqData[18].resposta,
    "resetar senha": faqData[18].resposta,
    "editar perfil": faqData[19].resposta,
    "alterar perfil": faqData[19].resposta,
    "multiplas contas": faqData[20].resposta,
    "trocar conta": faqData[20].resposta,
    "dashboard": faqData[21].resposta,
    "o que mostra": faqData[21].resposta,
    "subir nivel": faqData[22].resposta,
    "aumentar nivel": faqData[22].resposta,
    "formato imagem": faqData[23].resposta,
    "tamanho imagem": faqData[23].resposta,
    "como ganhar pontos": faqData[24].resposta,
    "acumular pontos": faqData[24].resposta,
    "engajar clientes": faqData[25].resposta,
    "atrair clientes": faqData[25].resposta,
    "notificacao": faqData[26].resposta,
    "notificacoes": faqData[26].resposta,
    "provincias": faqData[27].resposta,
    "onde atende": faqData[27].resposta,
    "cobertura": faqData[27].resposta,
    "preco": faqData[28].resposta,
    "custo": faqData[28].resposta,
    "gratuito": faqData[28].resposta,
    "quanto custa": faqData[28].resposta,
    "gratis": faqData[28].resposta,
    "seguro": faqData[29].resposta,
    "seguranca": faqData[29].resposta,
    "confiavel": faqData[29].resposta,
    "oi": "Olá! 👋 Sou o assistente do FocoJá. Como posso ajudar você hoje? Pergunte sobre cadastro, compras, cupons, fidelidade ou qualquer outra dúvida!",
    "ola": "Olá! 👋 Sou o assistente do FocoJá. Como posso ajudar você hoje?",
    "obrigado": "Por nada! 😊 Estou aqui para ajudar. Precisa de mais alguma coisa?",
    "obrigada": "Por nada! 😊 Estou aqui para ajudar. Precisa de mais alguma coisa?"
};

// ==================== VARIÁVEIS DO ASSISTENTE ====================

let helpChatHistory = [];
let helpTypingTimeout = null;

// ==================== FUNÇÕES DO ASSISTENTE ====================

function carregarFAQ() {
    const faqContainer = document.getElementById('faqContent');
    if (!faqContainer) return;
    
    let html = '';
    
    for (const item of faqData) {
        html += `
            <div class="faq-item">
                <div class="faq-question" data-faq="${item.id}">
                    ${item.pergunta}
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="faq-answer" data-faq-answer="${item.id}">
                    ${item.resposta}
                </div>
            </div>
        `;
    }
    
    faqContainer.innerHTML = html;
    
    // Adicionar eventos de clique para expandir/resposta
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const id = question.dataset.faq;
            const answer = document.querySelector(`.faq-answer[data-faq-answer="${id}"]`);
            const icon = question.querySelector('i');
            
            answer.classList.toggle('show');
            
            if (answer.classList.contains('show')) {
                icon.style.transform = 'rotate(180deg)';
            } else {
                icon.style.transform = 'rotate(0deg)';
            }
        });
    });
}

function getBotResponse(message) {
    const lowerMsg = message.toLowerCase().trim();
    
    // Verifica correspondência
    for (const [key, response] of Object.entries(botResponses)) {
        if (lowerMsg.includes(key)) {
            return response;
        }
    }
    
    // Resposta padrão com sugestões
    return `❓ Não entendi sua pergunta. 🤔

💡 Você pode perguntar sobre:

📝 CADASTRO
• Como criar conta
• Cadastro empresa/cliente

🛒 COMPRAS
• Como comprar
• Como negociar
• Aplicar cupom

📦 VENDAS
• Publicar produto
• Criar cupom
• Gerenciar pedidos

⭐ FIDELIDADE
• Como ganhar pontos
• Níveis e benefícios

🔧 CONFIGURAÇÕES
• Editar perfil
• Recuperar senha

Digite o assunto que deseja saber!`;
}

function addHelpMessage(text, isUser = true) {
    const messagesContainer = document.getElementById('helpChatMessages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `help-chat-message ${isUser ? 'user' : 'bot'}`;
    messageDiv.innerHTML = text.replace(/\n/g, '<br>');
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    helpChatHistory.push({ text, isUser, timestamp: Date.now() });
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('helpChatMessages');
    if (!messagesContainer) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = '<span></span><span></span><span></span>';
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

async function sendHelpMessage(message) {
    if (!message.trim()) return;
    
    addHelpMessage(message, true);
    
    const input = document.getElementById('helpChatInput');
    if (input) input.value = '';
    
    showTypingIndicator();
    
    if (helpTypingTimeout) clearTimeout(helpTypingTimeout);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    removeTypingIndicator();
    
    const response = getBotResponse(message);
    addHelpMessage(response, false);
}

function openHelpModal() {
    const modal = document.getElementById('helpModal');
    const badge = document.getElementById('helpBadge');
    
    if (modal) modal.style.display = 'flex';
    if (badge) badge.style.display = 'none';
    
    localStorage.setItem('helpLastSeen', Date.now());
    
    // Recarregar FAQ ao abrir
    carregarFAQ();
}

function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) modal.style.display = 'none';
}

function setupHelpSystem() {
    // Verificar se os elementos existem
    const helpButton = document.getElementById('helpButton');
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const sendBtn = document.getElementById('sendHelpMessageBtn');
    const helpInput = document.getElementById('helpChatInput');
    
    if (!helpButton) {
        console.log('Elementos do help não encontrados, aguardando...');
        return;
    }
    
    if (helpButton) helpButton.addEventListener('click', openHelpModal);
    if (closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelpModal);
    
    if (sendBtn && helpInput) {
        sendBtn.addEventListener('click', () => {
            const message = helpInput.value.trim();
            if (message) sendHelpMessage(message);
        });
        
        helpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const message = helpInput.value.trim();
                if (message) sendHelpMessage(message);
            }
        });
    }
    
    // Tabs do help
    const tabs = document.querySelectorAll('.help-tab');
    const tabContents = {
        faq: document.getElementById('faqContent'),
        chat: document.getElementById('chatContent'),
        suporte: document.getElementById('suporteContent')
    };
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            Object.values(tabContents).forEach(content => {
                if (content) content.style.display = 'none';
            });
            
            const tabName = tab.dataset.tab;
            if (tabContents[tabName]) tabContents[tabName].style.display = 'block';
            
            if (tabName === 'faq') carregarFAQ();
        });
    });
    
    // Quick actions
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const msg = btn.dataset.msg;
            if (msg) sendHelpMessage(msg);
        });
    });
    
    // Suporte humano
    const humanSupportBtn = document.getElementById('startHumanSupportBtn');
    if (humanSupportBtn) {
        humanSupportBtn.addEventListener('click', () => {
            sendHelpMessage("Gostaria de falar com um atendente humano.");
            setTimeout(() => {
                addHelpMessage("📞 Um atendente entrará em contato em breve. Você também pode nos chamar no WhatsApp: +244 956 915 717", false);
            }, 500);
        });
    }
    
    // Badge de notificação (mostrar uma vez por dia)
    const lastSeen = localStorage.getItem('helpLastSeen');
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const badge = document.getElementById('helpBadge');
    
    if (badge && (!lastSeen || (now - parseInt(lastSeen) > oneDay))) {
        badge.style.display = 'flex';
    }
    
    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('helpModal');
        const helpBtn = document.getElementById('helpButton');
        
        if (modal && modal.style.display === 'flex') {
            if (!modal.contains(e.target) && !helpBtn?.contains(e.target)) {
                closeHelpModal();
            }
        }
    });
    
    // Mensagem de boas-vindas
    setTimeout(() => {
        const messagesContainer = document.getElementById('helpChatMessages');
        if (messagesContainer && messagesContainer.children.length === 0) {
            addHelpMessage("Olá! 👋 Sou o assistente virtual do FocoJá. Como posso ajudar você hoje?", false);
        }
    }, 500);
}

// ==================== INICIALIZAR ASSISTENTE ====================
// Chamar a função quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(setupHelpSystem, 500);
    });
} else {
    setTimeout(setupHelpSystem, 500);
}
// ==================== EVENTOS GLOBAIS ====================

document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
    document.getElementById('settingsScreen').style.display = 'none';
});

document.getElementById('editProfileSettingsBtn')?.addEventListener('click', async () => {
    const { value: nome } = await Swal.fire({
        title: 'Editar nome',
        input: 'text',
        inputValue: currentUserType === 'empresa' ? currentUserData?.nomeEmpresa : currentUserData?.nome,
        showCancelButton: true,
        confirmButtonText: 'Salvar',
        confirmButtonColor: '#0A2647'
    });

    if (nome && nome.trim()) {
        const updates = currentUserType === 'empresa'
            ? { nomeEmpresa: nome.trim() }
            : { nome: nome.trim() };

        await db.ref(`${currentUserType === 'empresa' ? 'empresas' : 'clientes'}/${currentUser.uid}`).update(updates);
        await currentUser.updateProfile({ displayName: nome.trim() });

        if (currentUserType === 'empresa') currentUserData.nomeEmpresa = nome.trim();
        else currentUserData.nome = nome.trim();

        showToast('Perfil atualizado!');
        document.getElementById('settingsScreen').style.display = 'none';
        renderPerfil();
    }
});

document.getElementById('changePasswordSettingsBtn')?.addEventListener('click', async () => {
    await auth.sendPasswordResetEmail(currentUser.email);
    showToast('Link de recuperação enviado para seu e-mail!');
});

document.getElementById('logoutSettingsBtn')?.addEventListener('click', () => {
    auth.signOut();
});

document.getElementById('closeChatBtn')?.addEventListener('click', () => {
    document.getElementById('chatScreen').style.display = 'none';
    if (currentChatMessagesRef) {
        currentChatMessagesRef.off();
        currentChatMessagesRef = null;
    }
    currentChatId = null;
    if (activeNav === 'chats') renderChats();
});

document.getElementById('sendChatMessageBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('chatInputMessage');
    const message = input.value.trim();
    if (!message || !currentChatId) return;

    const messagesRef = db.ref(`chats/${currentChatId}/mensagens`);
    await messagesRef.push({
        texto: message,
        de: currentUser.uid,
        para: currentChatDestinatarioId,
        data: Date.now(),
        lida: false
    });

    await db.ref(`chats/${currentChatId}`).update({
        ultimaMensagem: message,
        ultimaAtualizacao: Date.now()
    });

    input.value = '';
});

document.getElementById('chatInputMessage')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('sendChatMessageBtn').click();
});

document.getElementById('closeGrupoChatBtn')?.addEventListener('click', () => {
    document.getElementById('grupoChatScreen').style.display = 'none';
    if (currentGrupoMessagesRef) {
        currentGrupoMessagesRef.off();
        currentGrupoMessagesRef = null;
    }
    currentGrupoId = null;
    if (activeNav === 'grupos') renderGrupos();
});

document.getElementById('sendGrupoMessageBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('grupoChatInput');
    const message = input.value.trim();
    if (!message || !currentGrupoId) return;

    const messagesRef = db.ref(`gruposMensagens/${currentGrupoId}`);
    await messagesRef.push({
        texto: message,
        de: currentUser.uid,
        data: Date.now()
    });

    input.value = '';
});

document.getElementById('grupoChatInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('sendGrupoMessageBtn').click();
});

document.getElementById('grupoInfoBtn')?.addEventListener('click', showGrupoInfo);

document.getElementById('closeEmpresaProfileBtn')?.addEventListener('click', () => {
    document.getElementById('empresaProfileScreen').style.display = 'none';
});

document.getElementById('closeCuponsBtn')?.addEventListener('click', () => {
    document.getElementById('cuponsScreen').style.display = 'none';
});

document.getElementById('novoCupomBtn')?.addEventListener('click', () => {
    showNovoCupomModal();
});

document.getElementById('closeCarrinhoBtn')?.addEventListener('click', () => {
    document.getElementById('carrinhoScreen').style.display = 'none';
    if (activeNav === 'carrinho') setActiveNav('feed');
});

document.getElementById('closeGerenciarMembrosBtn')?.addEventListener('click', () => {
    document.getElementById('gerenciarMembrosScreen').style.display = 'none';
});

// ==================== INICIALIZAÇÃO ====================

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;

    const empresaSnap = await db.ref(`empresas/${user.uid}`).once('value');
    if (empresaSnap.exists()) {
        currentUserType = 'empresa';
        currentUserData = empresaSnap.val();
    } else {
        const clienteSnap = await db.ref(`clientes/${user.uid}`).once('value');
        if (clienteSnap.exists()) {
            currentUserType = 'cliente';
            currentUserData = clienteSnap.val();
        } else {
            currentUserType = 'cliente';
            currentUserData = { nome: user.displayName || 'Cliente' };
            await db.ref(`clientes/${user.uid}`).set({
                nome: currentUserData.nome,
                email: user.email,
                dataCadastro: Date.now()
            });
        }
    }

    updatePublishButton();
    loadEmpresas();
    loadStorysRealtime();
    loadPublicacoesRealtime();
    loadUnreadChats();
    carregarCarrinho();
    setupHelpSystem();
    await carregarMeusPedidos();
    setActiveNav('dashboard');
});
