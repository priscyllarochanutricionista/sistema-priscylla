// ==========================================
// 1. SISTEMA DE LOGIN (BLINDADO)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');
    const viewLogin = document.getElementById('view-login');
    const viewApp = document.getElementById('view-app');
    const msgErroLogin = document.getElementById('msg-erro-login');

    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault(); // Bloqueia o recarregamento da página IMEDIATAMENTE

            if (document.getElementById('login').value === 'admin' && document.getElementById('senha').value === 'admin') {
                msgErroLogin.classList.add('hidden'); 
                viewLogin.classList.add('hidden'); 
                viewApp.classList.remove('hidden');
                
                // Inicializa o banco de dados ao logar
                carregarPainelFinanceiro();
                carregarCategorias();
            } else {
                msgErroLogin.classList.remove('hidden');
            }
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            viewApp.classList.add('hidden'); 
            viewLogin.classList.remove('hidden'); 
            formLogin.reset();
        });
    }

    // ==========================================
    // 2. ROTEADOR DE TELAS
    // ==========================================
    const telas = {
        'dashboard': document.getElementById('tela-dashboard'), 'agenda': document.getElementById('tela-agenda'),
        'receitas': document.getElementById('tela-receitas'), 'despesas': document.getElementById('tela-despesas'),
        'pacientes': document.getElementById('tela-pacientes'), 'categorias': document.getElementById('tela-categorias'),
        'rel-receitas': document.getElementById('tela-relatorios'), 'rel-despesas': document.getElementById('tela-relatorios'),
        'rel-resultado': document.getElementById('tela-relatorios'), 'rel-agendamentos': document.getElementById('tela-rel-agendamentos')
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

    // ==========================================
    // 3. EVENTOS DE SALVAR (RECEITAS E DESPESAS)
    // ==========================================
    const formReceita = document.getElementById('form-receita');
    if (formReceita) {
        formReceita.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formReceita.querySelector('button[type="submit"]');
            const txtOrg = btn.innerHTML;
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Salvando...'; btn.disabled = true;

            const dados = [
                document.getElementById('data-receita').value,
                'Receita', 
                document.getElementById('desc-receita').value,
                '', 
                document.getElementById('valor-receita').value,
                'Pago' 
            ];

            const res = await enviarParaBanco('salvar', 'Lancamentos', dados);
            btn.innerHTML = txtOrg; btn.disabled = false;

            if (res.status === 'sucesso') {
                alert('✅ Receita registrada com sucesso!');
                formReceita.reset();
                carregarPainelFinanceiro(); 
            } else {
                alert('❌ Erro: ' + res.mensagem);
            }
        });
    }

    const formDespesa = document.getElementById('form-despesa');
    if (formDespesa) {
        formDespesa.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formDespesa.querySelector('button[type="submit"]');
            const txtOrg = btn.innerHTML;
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Salvando...'; btn.disabled = true;

            const dados = [
                document.getElementById('data-despesa').value,
                'Despesa', 
                document.getElementById('desc-despesa').value,
                document.getElementById('cat-despesa').value,
                document.getElementById('valor-despesa').value,
                'Pago' 
            ];

            const res = await enviarParaBanco('salvar', 'Lancamentos', dados);
            btn.innerHTML = txtOrg; btn.disabled = false;

            if (res.status === 'sucesso') {
                alert('✅ Despesa registrada com sucesso!');
                formDespesa.reset();
                carregarPainelFinanceiro();
            } else {
                alert('❌ Erro: ' + res.mensagem);
            }
        });
    }
}); // Fim do DOMContentLoaded

// ==========================================
// 4. CONFIGURAÇÕES E API (GOOGLE SHEETS)
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzmrx8ds2GZLGjOoFz-VKdjMEPXHagDsYwRPuxX_YIp4KpoQvnNOl6PIsQGFba77SIJng/exec';

function formatarMoeda(valor) {
    const numero = parseFloat(valor) || 0;
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataISO) {
    if (!dataISO) return '-';
    const dataLimpa = dataISO.substring(0, 10); 
    const partes = dataLimpa.split('-');
    if (partes.length !== 3) return dataISO;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

async function buscarDados(tabela) {
    try {
        const resposta = await fetch(`${API_URL}?tabela=${tabela}`);
        const resultado = await resposta.json();
        return resultado.dados || [];
    } catch (erro) {
        console.error(`Erro ao buscar ${tabela}:`, erro);
        return [];
    }
}

async function enviarParaBanco(acao, tabela, dados = null, id = null) {
    const pacote = { acao, tabela, dados, id };
    const resposta = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(pacote)
    });
    return await resposta.json();
}

// ==========================================
// 5. INTELIGÊNCIA FINANCEIRA (DASHBOARD)
// ==========================================
async function carregarPainelFinanceiro() {
    const lancamentos = await buscarDados('Lancamentos');
    
    let totalReceita = 0;
    let totalDespesa = 0;
    const listaReceitas = [];
    const listaDespesas = [];

    lancamentos.forEach(lanc => {
        const valor = parseFloat(lanc.Valor) || 0;
        if (lanc.Tipo === 'Receita') {
            totalReceita += valor;
            listaReceitas.push(lanc);
        } else if (lanc.Tipo === 'Despesa') {
            totalDespesa += valor;
            listaDespesas.push(lanc);
        }
    });

    document.getElementById('kpi-receita').textContent = formatarMoeda(totalReceita);
    document.getElementById('kpi-despesa').textContent = formatarMoeda(totalDespesa);
    document.getElementById('kpi-lucro').textContent = formatarMoeda(totalReceita - totalDespesa);

    renderizarTabelaFinanceira('tbody-receitas', listaReceitas.reverse().slice(0, 10), 'Receita');
    renderizarTabelaFinanceira('tbody-despesas', listaDespesas.reverse().slice(0, 10), 'Despesa');
}

function renderizarTabelaFinanceira(idTbody, dados, tipo) {
    const tbody = document.getElementById(idTbody);
    if (!tbody) return;

    if (dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = ''; 
    dados.forEach(item => {
        const tr = document.createElement('tr');
        if (tipo === 'Receita') {
            tr.innerHTML = `
                <td>${formatarData(item.Data)}</td>
                <td><strong>${item.Descricao}</strong></td>
                <td class="text-success" style="font-weight: 600;">${formatarMoeda(item.Valor)}</td>
                <td class="text-center">
                    <button onclick="editarRegistro('${item.ID}')" class="btn-icon" style="color: var(--color-primary); background: none; border: none; font-size: 1.1rem; cursor: pointer; margin-right: 0.5rem;" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                    <button onclick="excluirRegistro('Lancamentos', '${item.ID}')" class="btn-icon" style="color: var(--color-danger); background: none; border: none; font-size: 1.1rem; cursor: pointer;" title="Excluir"><i class="ph ph-trash"></i></button>
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td>${formatarData(item.Data)}</td>
                <td><span class="badge" style="background: #f1f5f9; color: #475569; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${item.Categoria || 'Sem Categoria'}</span></td>
                <td><strong>${item.Descricao}</strong></td>
                <td class="text-danger" style="font-weight: 600;">${formatarMoeda(item.Valor)}</td>
                <td class="text-center">
                    <button onclick="editarRegistro('${item.ID}')" class="btn-icon" style="color: var(--color-primary); background: none; border: none; font-size: 1.1rem; cursor: pointer; margin-right: 0.5rem;"><i class="ph ph-pencil-simple"></i></button>
                    <button onclick="excluirRegistro('Lancamentos', '${item.ID}')" class="btn-icon" style="color: var(--color-danger); background: none; border: none; font-size: 1.1rem; cursor: pointer;"><i class="ph ph-trash"></i></button>
                </td>
            `;
        }
        tbody.appendChild(tr);
    });
}

async function carregarCategorias() {
    const categorias = await buscarDados('Categorias');
    const select = document.getElementById('cat-despesa');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione uma categoria...</option>';
    categorias.forEach(cat => {
        if (cat.Natureza === 'Despesa') {
            select.innerHTML += `<option value="${cat.Nome_Categoria}">${cat.Nome_Categoria}</option>`;
        }
    });
}

// ==========================================
// 6. EXCLUIR E EDITAR (Globais)
// ==========================================
window.excluirRegistro = async function(tabela, id) {
    if (!confirm('Tem certeza que deseja apagar este registro permanentemente?')) return;
    
    const res = await enviarParaBanco('excluir', tabela, null, id);
    if (res.status === 'sucesso') {
        alert('🗑️ Registro excluído.');
        carregarPainelFinanceiro(); 
    } else {
        alert('❌ Erro ao excluir: ' + res.mensagem);
    }
}

window.editarRegistro = function(id) {
    alert('⚠️ A Edição completa será ativada na próxima atualização para garantir a integridade do banco de dados.');
}
