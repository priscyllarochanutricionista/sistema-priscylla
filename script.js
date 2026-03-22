document.addEventListener('DOMContentLoaded', () => {
    // 1. SISTEMA DE LOGIN 
    const formLogin = document.getElementById('form-login');
    const viewLogin = document.getElementById('view-login');
    const viewApp = document.getElementById('view-app');
    const msgErroLogin = document.getElementById('msg-erro-login');

    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault(); 
            if (document.getElementById('login').value === 'admin' && document.getElementById('senha').value === 'admin') {
                msgErroLogin.classList.add('hidden'); viewLogin.classList.add('hidden'); viewApp.classList.remove('hidden');
                // INICIALIZA O BANCO DE DADOS
                carregarPainelFinanceiro();
                carregarCategorias();
                carregarPacientes();
            } else { msgErroLogin.classList.remove('hidden'); }
        });
    }

    document.getElementById('btn-logout').addEventListener('click', () => {
        viewApp.classList.add('hidden'); viewLogin.classList.remove('hidden'); formLogin.reset();
    });

    // 2. ROTEADOR DE TELAS
    const telas = {
        'dashboard': document.getElementById('tela-dashboard'), 'agenda': document.getElementById('tela-agenda'),
        'receitas': document.getElementById('tela-receitas'), 'despesas': document.getElementById('tela-despesas'),
        'pacientes': document.getElementById('tela-pacientes'), 'categorias': document.getElementById('tela-categorias'),
        'rel-receitas': document.getElementById('tela-relatorios'), 'rel-agendamentos': document.getElementById('tela-relatorios')
    };

    document.querySelectorAll('.sidebar a').forEach(link => {
        if (link.getAttribute('href').startsWith('#')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const destino = e.currentTarget.getAttribute('href').replace('#', '');
                if (!telas[destino]) return;
                document.querySelectorAll('.sidebar a').forEach(l => l.classList.remove('active'));
                e.currentTarget.classList.add('active');
                Object.values(telas).forEach(t => { if (t) t.classList.add('hidden'); });
                telas[destino].classList.remove('hidden');
                document.getElementById('titulo-pagina').textContent = e.currentTarget.textContent.trim();
            });
        }
    });

    // 3. EVENTOS DE SALVAR (FORMULÁRIOS)
    function configurarFormulario(idForm, tabela, btnClass, preparadorDeDados, callbackSucesso) {
        const form = document.getElementById(idForm);
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const txtOrg = btn.innerHTML;
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Aguarde...'; btn.disabled = true;
            
            const dados = preparadorDeDados();
            const res = await enviarParaBanco('salvar', tabela, dados);
            btn.innerHTML = txtOrg; btn.disabled = false;

            if (res.status === 'sucesso') {
                alert(`✅ Salvo com sucesso!`);
                form.reset();
                callbackSucesso();
            } else {
                alert('❌ Erro: ' + res.mensagem);
            }
        });
    }

    // A - Form Receita
    configurarFormulario('form-receita', 'Lancamentos', 'btn-primary', () => [
        document.getElementById('data-receita').value, 'Receita', document.getElementById('desc-receita').value,
        '', document.getElementById('valor-receita').value, 'Pago'
    ], carregarPainelFinanceiro);

    // B - Form Despesa
    configurarFormulario('form-despesa', 'Lancamentos', 'btn-danger', () => [
        document.getElementById('data-despesa').value, 'Despesa', document.getElementById('desc-despesa').value,
        document.getElementById('cat-despesa').value, document.getElementById('valor-despesa').value, 'Pago'
    ], carregarPainelFinanceiro);

    // C - Form Categoria (NOVO)
    configurarFormulario('form-categoria', 'Categorias', 'btn-primary', () => [
        document.getElementById('nome-categoria').value,
        document.getElementById('nat-categoria').value
    ], () => { carregarCategorias(); carregarPainelFinanceiro(); });

    // D - Form Paciente (NOVO)
    configurarFormulario('form-paciente', 'Pacientes', 'btn-primary', () => {
        const hoje = new Date().toISOString().split('T')[0];
        return [
            document.getElementById('nome-paciente').value,
            document.getElementById('tel-paciente').value,
            document.getElementById('email-paciente').value || 'Sem e-mail',
            hoje
        ];
    }, carregarPacientes);

}); // Fim do DOMContentLoaded

// ==========================================
// 4. API GOOGLE SHEETS E FORMATAÇÕES
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzmrx8ds2GZLGjOoFz-VKdjMEPXHagDsYwRPuxX_YIp4KpoQvnNOl6PIsQGFba77SIJng/exec';

function formatarMoeda(valor) {
    return (parseFloat(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// O NOVO FORMATADOR DE DATA "ANTI-BUG"
function formatarData(valor) {
    if (!valor) return '-';
    // Limpa a string cortando lixos do fuso horário
    const dataLimpa = String(valor).split('T')[0]; 
    const partes = dataLimpa.split('-');
    if (partes.length >= 3) {
        let ano = partes[partes.length - 3].replace('+', '');
        // Se o ano vier com 5 ou 6 dígitos (ex: 020026), pega só os 4 últimos
        if (ano.length > 4) ano = ano.substring(ano.length - 4); 
        const mes = partes[partes.length - 2];
        const dia = partes[partes.length - 1];
        return `${dia}/${mes}/${ano}`;
    }
    return valor;
}

async function buscarDados(tabela) {
    try {
        const res = await fetch(`${API_URL}?tabela=${tabela}`);
        const json = await res.json();
        return json.dados || [];
    } catch (e) { console.error(e); return []; }
}

async function enviarParaBanco(acao, tabela, dados = null, id = null) {
    const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ acao, tabela, dados, id })
    });
    return await res.json();
}

// ==========================================
// 5. INTELIGÊNCIA DE LISTAGEM
// ==========================================
async function carregarPainelFinanceiro() {
    const lanc = await buscarDados('Lancamentos');
    let rec = 0, des = 0;
    const lRec = [], lDes = [];
    
    lanc.forEach(l => {
        const val = parseFloat(l.Valor) || 0;
        if (l.Tipo === 'Receita') { rec += val; lRec.push(l); } 
        else if (l.Tipo === 'Despesa') { des += val; lDes.push(l); }
    });

    document.getElementById('kpi-receita').textContent = formatarMoeda(rec);
    document.getElementById('kpi-despesa').textContent = formatarMoeda(des);
    document.getElementById('kpi-lucro').textContent = formatarMoeda(rec - des);

    renderizarTabela('tbody-receitas', lRec.reverse().slice(0, 10), l => `
        <td>${formatarData(l.Data)}</td><td><strong>${l.Descricao}</strong></td><td class="text-success">${formatarMoeda(l.Valor)}</td>
        <td class="text-center">${botoesAcao('Lancamentos', l.ID)}</td>
    `);

    renderizarTabela('tbody-despesas', lDes.reverse().slice(0, 10), l => `
        <td>${formatarData(l.Data)}</td><td><span class="badge">${l.Categoria||'Geral'}</span></td><td><strong>${l.Descricao}</strong></td><td class="text-danger">${formatarMoeda(l.Valor)}</td>
        <td class="text-center">${botoesAcao('Lancamentos', l.ID)}</td>
    `);
}

async function carregarCategorias() {
    const cats = await buscarDados('Categorias');
    
    // Alimenta o Select do form de Despesas
    const select = document.getElementById('cat-despesa');
    if (select) {
        select.innerHTML = '<option value="">Selecione uma categoria...</option>';
        cats.forEach(c => { if(c.Natureza === 'Despesa') select.innerHTML += `<option value="${c.Nome_Categoria}">${c.Nome_Categoria}</option>`; });
    }

    // Alimenta a Tabela de Categorias
    renderizarTabela('tbody-categorias', cats.reverse(), c => {
        const cor = c.Natureza === 'Receita' ? 'success' : 'danger';
        return `<td><strong>${c.Nome_Categoria}</strong></td><td><span class="text-${cor}">${c.Natureza}</span></td><td class="text-center">${botoesAcao('Categorias', c.ID)}</td>`;
    });
}

async function carregarPacientes() {
    const pacs = await buscarDados('Pacientes');
    renderizarTabela('tbody-pacientes', pacs.reverse(), p => `
        <td>${formatarData(p.Data_Cadastro)}</td><td><strong>${p.Nome_Completo}</strong></td><td>${p.Telefone}</td><td>${p.Email}</td>
        <td class="text-center">${botoesAcao('Pacientes', p.ID)}</td>
    `);
}

// Função Utilitária para renderizar tabelas dinâmicas
function renderizarTabela(id, dados, templateTr) {
    const tbody = document.getElementById(id);
    if(!tbody) return;
    if(dados.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhum registro encontrado.</td></tr>`; return; }
    tbody.innerHTML = '';
    dados.forEach(d => { const tr = document.createElement('tr'); tr.innerHTML = templateTr(d); tbody.appendChild(tr); });
}

function botoesAcao(tabela, id) {
    return `
        <button onclick="editarRegistro('${id}')" class="btn-icon" style="color: var(--color-primary); background: none; border: none; font-size: 1.1rem; cursor: pointer; margin-right: 0.5rem;"><i class="ph ph-pencil-simple"></i></button>
        <button onclick="excluirRegistro('${tabela}', '${id}')" class="btn-icon" style="color: var(--color-danger); background: none; border: none; font-size: 1.1rem; cursor: pointer;"><i class="ph ph-trash"></i></button>
    `;
}

// ==========================================
// 6. AÇÕES GLOBAIS (EXCLUIR / EDITAR)
// ==========================================
window.excluirRegistro = async function(tabela, id) {
    if (!confirm(`Tem certeza que deseja apagar este registro de ${tabela}?`)) return;
    const res = await enviarParaBanco('excluir', tabela, null, id);
    if (res.status === 'sucesso') {
        alert('🗑️ Registro excluído.');
        if(tabela === 'Lancamentos') carregarPainelFinanceiro();
        if(tabela === 'Categorias') carregarCategorias();
        if(tabela === 'Pacientes') carregarPacientes();
    } else alert('❌ Erro: ' + res.mensagem);
}

window.editarRegistro = function(id) {
    alert('⚠️ A Edição em Formulário (Update) será lançada na última atualização junto com o PDF.');
}
