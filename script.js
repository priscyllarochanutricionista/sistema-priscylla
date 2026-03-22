// ==========================================
// 1. SELETORES DO DOM (Login e Telas)
// ==========================================
const formLogin = document.getElementById('form-login');
const inputLogin = document.getElementById('login');
const inputSenha = document.getElementById('senha');
const msgErroLogin = document.getElementById('msg-erro-login');

const viewLogin = document.getElementById('view-login');
const viewApp = document.getElementById('view-app');
const btnLogout = document.getElementById('btn-logout');

// ==========================================
// 2. LÓGICA DE AUTENTICAÇÃO SIMULADA
// ==========================================
function realizarLogin(evento) {
    evento.preventDefault(); 

    const loginDigitado = inputLogin.value;
    const senhaDigitada = inputSenha.value;

    if (loginDigitado === 'admin' && senhaDigitada === 'admin') {
        msgErroLogin.classList.add('hidden'); 
        viewLogin.classList.add('hidden');    
        viewApp.classList.remove('hidden');   
    } else {
        msgErroLogin.classList.remove('hidden'); 
    }
}

function realizarLogout() {
    viewApp.classList.add('hidden');
    viewLogin.classList.remove('hidden');
    formLogin.reset(); 
}

// ==========================================
// 3. ROTEADOR DE TELAS (Navegação do Menu)
// ==========================================
const telas = {
    'dashboard': document.getElementById('tela-dashboard'),
    'agenda': document.getElementById('tela-agenda'),
    'receitas': document.getElementById('tela-lancamentos'),
    'despesas': document.getElementById('tela-lancamentos'),
    'pacientes': document.getElementById('tela-pacientes'),
    'categorias': document.getElementById('tela-categorias'),
    'rel-receitas': document.getElementById('tela-relatorios'),
    'rel-despesas': document.getElementById('tela-relatorios'),
    'rel-resultado': document.getElementById('tela-relatorios'),
    'rel-agendamentos': document.getElementById('tela-rel-agendamentos')
};

const linksMenu = document.querySelectorAll('.sidebar a');
const tituloPagina = document.getElementById('titulo-pagina');

function trocarTela(evento) {
    evento.preventDefault();

    const linkClicado = evento.currentTarget;
    const destino = linkClicado.getAttribute('href').replace('#', ''); 
    
    if (!telas[destino]) return; 

    linksMenu.forEach(link => link.classList.remove('active'));
    linkClicado.classList.add('active');

    Object.values(telas).forEach(tela => {
        if (tela) tela.classList.add('hidden');
    });

    telas[destino].classList.remove('hidden');
    tituloPagina.textContent = linkClicado.textContent.trim();
}

// ==========================================
// 4. INTEGRAÇÃO COM GOOGLE SHEETS (API)
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwXi5dBCjEpKEfskGrk64OY3KBapA5TlDs7KXiP9x6rDvWWY37kd8IACyX9ZrXyR21Jhg/exec';
const formLancamento = document.getElementById('form-lancamento');

// Só adiciona o evento se o formulário existir na tela
if (formLancamento) {
    formLancamento.addEventListener('submit', async function(evento) {
        
        // ISSO AQUI IMPEDE A PÁGINA DE RECARREGAR (E VOLTAR PRO LOGIN)
        evento.preventDefault(); 

        const btnSalvar = formLancamento.querySelector('button[type="submit"]');
        const textoOriginal = btnSalvar.innerHTML;
        
        // Efeito visual de carregamento
        btnSalvar.innerHTML = '<i class="ph ph-spinner ph-spin" style="margin-right: 0.5rem;"></i> Registrando...';
        btnSalvar.disabled = true;
        btnSalvar.style.opacity = '0.7';

        // Captura os dados exatos do formulário
        const dataDigitada = document.getElementById('data-lancamento').value;
        const tipoSelecionado = document.getElementById('tipo-lancamento').value;
        const descricaoDigitada = document.getElementById('descricao').value;
        const categoriaSelecionada = document.getElementById('categoria').value;
        const valorDigitado = document.getElementById('valor').value;
        const statusSelecionado = document.getElementById('status-pagamento').value;

        // Prepara o pacote para a nossa API
        const pacoteDeDados = {
            tabela: "Lancamentos",
            dados: [
                dataDigitada,
                tipoSelecionado,
                descricaoDigitada,
                categoriaSelecionada,
                valorDigitado,
                statusSelecionado
            ]
        };

        try {
            // Envia para o Google Sheets (Usamos text/plain para evitar bloqueios de CORS do navegador)
            const resposta = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(pacoteDeDados)
            });

            const resultado = await resposta.json();

            if (resultado.status === 'sucesso') {
                alert('✅ Lançamento salvo com sucesso no banco de dados!');
                formLancamento.reset(); 
            } else {
                alert('❌ Erro retornado pelo servidor: ' + resultado.mensagem);
            }

        } catch (erro) {
            alert('❌ Ops! Erro de conexão ao salvar. Verifique sua internet.');
            console.error(erro);
        } finally {
            // Restaura o botão
            btnSalvar.innerHTML = textoOriginal;
            btnSalvar.disabled = false;
            btnSalvar.style.opacity = '1';
        }
    });
}

// ==========================================
// 5. INICIALIZAÇÃO DE EVENTOS
// ==========================================
formLogin.addEventListener('submit', realizarLogin);
btnLogout.addEventListener('click', realizarLogout);

linksMenu.forEach(link => {
    if (link.getAttribute('href').startsWith('#')) {
        link.addEventListener('click', trocarTela);
    }
});