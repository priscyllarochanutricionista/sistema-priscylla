document.addEventListener('DOMContentLoaded', () => {
    // 1. LOGIN
    const formLogin = document.getElementById('form-login');
    const viewLogin = document.getElementById('view-login');
    const viewApp = document.getElementById('view-app');
    const msgErroLogin = document.getElementById('msg-erro-login');

    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault(); 
            if (document.getElementById('login').value === 'admin' && document.getElementById('senha').value === 'admin') {
                msgErroLogin.classList.add('hidden'); viewLogin.classList.add('hidden'); viewApp.classList.remove('hidden');
                // Inicializa os módulos
                carregarPainelFinanceiro();
                carregarCategorias();
                carregarPacientes();
                carregarAgenda();
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
        'rel-receitas': document.getElementById('tela-relatorios')
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

    // 3. SALVAR (FORMULÁRIOS CRUD)
    function configurarFormulario(idForm, tabela, preparadorDeDados, callbackSucesso) {
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
            } else { alert('❌ Erro: ' + res.mensagem); }
        });
    }

    configurarFormulario('form-receita', 'Lancamentos', () => [
        document.getElementById('data-receita').value, 'Receita', document.getElementById('desc-receita').value, '', document.getElementById('valor-receita').value, 'Pago'
    ], carregarPainelFinanceiro);

    configurarFormulario('form-despesa', 'Lancamentos', () => [
        document.getElementById('data-despesa').value, 'Despesa', document.getElementById('desc-despesa').value, document.getElementById('cat-despesa').value, document.getElementById('valor-despesa').value, 'Pago'
    ], carregarPainelFinanceiro);

    configurarFormulario('form-categoria', 'Categorias', () => [
        document.getElementById('nome-categoria').value, document.getElementById('nat-categoria').value
    ], () => { carregarCategorias(); carregarPainelFinanceiro(); });

    configurarFormulario('form-paciente', 'Pacientes', () => [
        document.getElementById('nome-paciente').value, document.getElementById('tel-paciente').value, document.getElementById('email-paciente').value || 'Sem e-mail', new Date().toISOString().split('T')[0]
    ], carregarPacientes);

    // Form Agenda (NOVO)
    configurarFormulario('form-agenda', 'Agenda', () => [
        document.getElementById('data-agenda').value, document.getElementById('paciente-agenda').value, document.getElementById('tipo-agenda').value, 'Aguardando', 'Pendente', ''
    ], carregarAgenda);

    // 4. MÓDULO DE RELATÓRIOS E PDF (NOVO)
    const formFiltro = document.getElementById('form-filtro-relatorio');
    let dadosFiltradosParaPDF = [];

    if(formFiltro) {
        formFiltro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formFiltro.querySelector('button[type="submit"]');
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Buscando...'; btn.disabled = true;

            const dtInicio = document.getElementById('filtro-inicio').value;
            const dtFim = document.getElementById('filtro-fim').value;
            const lancamentos = await buscarDados('Lancamentos');
            
            // Filtra as datas
            dadosFiltradosParaPDF = lancamentos.filter(l => {
                const dataLanc = String(l.Data).split('T')[0];
                return dataLanc >= dtInicio && dataLanc <= dtFim;
            });

            // Ordena por data
            dadosFiltradosParaPDF.sort((a, b) => new Date(a.Data) - new Date(b.Data));

            let totalReceitas = 0; let totalDespesas = 0;
            renderizarTabela('tbody-relatorio', dadosFiltradosParaPDF, l => {
                const valor = parseFloat(l.Valor) || 0;
                if(l.Tipo === 'Receita') totalReceitas += valor; else totalDespesas += valor;
                const corClass = l.Tipo === 'Receita' ? 'text-success' : 'text-danger';
                return `<td>${formatarData(l.Data)}</td><td><span class="badge">${l.Tipo}</span></td><td>${l.Descricao}</td><td class="${corClass}">${formatarMoeda(valor)}</td>`;
            });

            // Mostra o botão do PDF se houver dados
            const btnPdf = document.getElementById('btn-gerar-pdf');
            if(dadosFiltradosParaPDF.length > 0) {
                btnPdf.style.display = 'inline-flex';
                // Adiciona linha de saldo no HTML
                document.getElementById('tbody-relatorio').innerHTML += `
                    <tr style="background-color: #f8fafc; font-weight: bold;">
                        <td colspan="3" class="text-right">SALDO DO PERÍODO:</td>
                        <td class="${(totalReceitas - totalDespesas) >= 0 ? 'text-success' : 'text-danger'}">${formatarMoeda(totalReceitas - totalDespesas)}</td>
                    </tr>`;
            } else { btnPdf.style.display = 'none'; }

            btn.innerHTML = '<i class="ph ph-funnel"></i> Gerar Relatório'; btn.disabled = false;
        });
    }

    // Ação do Botão PDF
    document.getElementById('btn-gerar-pdf').addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text("Relatório Financeiro - Priscylla Rocha", 14, 20);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Período: ${formatarData(document.getElementById('filtro-inicio').value)} até ${formatarData(document.getElementById('filtro-fim').value)}`, 14, 28);

        // Pega a tabela HTML desenhada e joga pro PDF
        doc.autoTable({
            html: '#tabela-relatorio-pdf',
            startY: 35,
            theme: 'striped',
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [13, 148, 136] } // Cor do tema (Teal)
        });

        doc.save(`Relatorio_Financeiro_${document.getElementById('filtro-inicio').value}.pdf`);
    });

}); // Fim DOMContentLoaded

// ==========================================
// FUNÇÕES GLOBAIS DE BANCO DE DADOS E FORMATAÇÃO
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzmrx8ds2GZLGjOoFz-VKdjMEPXHagDsYwRPuxX_YIp4KpoQvnNOl6PIsQGFba77SIJng/exec';

function formatarMoeda(valor) { return (parseFloat(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function formatarData(valor) {
    if (!valor) return '-';
    const dataLimpa = String(valor).split('T')[0]; 
    const partes = dataLimpa.split('-');
    if (partes.length >= 3) {
        let ano = partes[partes.length - 3].replace('+', '');
        if (ano.length > 4) ano = ano.substring(ano.length - 4); 
        return `${partes[partes.length - 1]}/${partes[partes.length - 2]}/${ano}`;
    }
    return valor;
}

// Formata Data e Hora (Ex: 22/03/2026 às 14:00)
function formatarDataHora(valorISO) {
    if(!valorISO) return '-';
    try {
        const [dataObj, horaObj] = valorISO.split('T');
        if(!horaObj) return formatarData(dataObj);
        return `${formatarData(dataObj)} às ${horaObj.substring(0,5)}`;
    } catch(e) { return valorISO; }
}

async function buscarDados(tabela) {
    try { const res = await fetch(`${API_URL}?tabela=${tabela}`); const json = await res.json(); return json.dados || []; } 
    catch (e) { console.error(e); return []; }
}

async function enviarParaBanco(acao, tabela, dados = null, id = null) {
    const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao, tabela, dados, id }) });
    return await res.json();
}

async function carregarPainelFinanceiro() {
    const lanc = await buscarDados('Lancamentos');
    let rec = 0, des = 0; const lRec = [], lDes = [];
    lanc.forEach(l => {
        const val = parseFloat(l.Valor) || 0;
        if (l.Tipo === 'Receita') { rec += val; lRec.push(l); } else if (l.Tipo === 'Despesa') { des += val; lDes.push(l); }
    });
    document.getElementById('kpi-receita').textContent = formatarMoeda(rec); document.getElementById('kpi-despesa').textContent = formatarMoeda(des); document.getElementById('kpi-lucro').textContent = formatarMoeda(rec - des);
    renderizarTabela('tbody-receitas', lRec.reverse().slice(0, 10), l => `<td>${formatarData(l.Data)}</td><td><strong>${l.Descricao}</strong></td><td class="text-success">${formatarMoeda(l.Valor)}</td><td class="text-center">${botoesAcao('Lancamentos', l.ID, l.Valor)}</td>`);
    renderizarTabela('tbody-despesas', lDes.reverse().slice(0, 10), l => `<td>${formatarData(l.Data)}</td><td><span class="badge">${l.Categoria||'Geral'}</span></td><td><strong>${l.Descricao}</strong></td><td class="text-danger">${formatarMoeda(l.Valor)}</td><td class="text-center">${botoesAcao('Lancamentos', l.ID, l.Valor)}</td>`);
}

async function carregarCategorias() {
    const cats = await buscarDados('Categorias');
    const select = document.getElementById('cat-despesa');
    if (select) {
        select.innerHTML = '<option value="">Selecione uma categoria...</option>';
        cats.forEach(c => { if(c.Natureza === 'Despesa') select.innerHTML += `<option value="${c.Nome_Categoria}">${c.Nome_Categoria}</option>`; });
    }
    renderizarTabela('tbody-categorias', cats.reverse(), c => `<td><strong>${c.Nome_Categoria}</strong></td><td><span class="text-${c.Natureza==='Receita'?'success':'danger'}">${c.Natureza}</span></td><td class="text-center">${botoesAcao('Categorias', c.ID)}</td>`);
}

async function carregarPacientes() {
    const pacs = await buscarDados('Pacientes');
    renderizarTabela('tbody-pacientes', pacs.reverse(), p => `<td>${formatarData(p.Data_Cadastro)}</td><td><strong>${p.Nome_Completo}</strong></td><td>${p.Telefone}</td><td>${p.Email}</td><td class="text-center">${botoesAcao('Pacientes', p.ID)}</td>`);
}

async function carregarAgenda() {
    const agenda = await buscarDados('Agenda');
    renderizarTabela('tbody-agenda', agenda.reverse(), a => `
        <td><strong>${formatarDataHora(a.Data_Hora)}</strong></td>
        <td>${a.Nome_Paciente}</td>
        <td><span class="badge" style="background:#e0f2fe; color:#0284c7;">${a.Tipo_Consulta}</span></td>
        <td><span class="text-warning"><i class="ph ph-clock"></i> ${a.Status_Presenca}</span></td>
        <td class="text-center">${botoesAcao('Agenda', a.ID)}</td>
    `);
}

function renderizarTabela(id, dados, templateTr) {
    const tbody = document.getElementById(id);
    if(!tbody) return;
    if(dados.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhum registro encontrado.</td></tr>`; return; }
    tbody.innerHTML = '';
    dados.forEach(d => { const tr = document.createElement('tr'); tr.innerHTML = templateTr(d); tbody.appendChild(tr); });
}

function botoesAcao(tabela, id, valorAntigo = '') {
    // Adicionado lógica básica de edição para valores (Apenas Lançamentos para simplificar sem poluir a tela)
    const btnEditar = tabela === 'Lancamentos' ? `<button onclick="editarValor('${id}', '${valorAntigo}')" class="btn-icon" style="color: var(--color-primary); background: none; border: none; font-size: 1.1rem; cursor: pointer; margin-right: 0.5rem;" title="Editar Valor"><i class="ph ph-pencil-simple"></i></button>` : '';
    return `
        ${btnEditar}
        <button onclick="excluirRegistro('${tabela}', '${id}')" class="btn-icon" style="color: var(--color-danger); background: none; border: none; font-size: 1.1rem; cursor: pointer;" title="Excluir"><i class="ph ph-trash"></i></button>
    `;
}

// ==========================================
// AÇÕES GLOBAIS (EXCLUIR / EDITAR VALOR)
// ==========================================
window.excluirRegistro = async function(tabela, id) {
    if (!confirm(`Tem certeza que deseja apagar este registro de ${tabela}?`)) return;
    const res = await enviarParaBanco('excluir', tabela, null, id);
    if (res.status === 'sucesso') {
        alert('🗑️ Registro excluído.');
        if(tabela === 'Lancamentos') carregarPainelFinanceiro();
        if(tabela === 'Categorias') carregarCategorias();
        if(tabela === 'Pacientes') carregarPacientes();
        if(tabela === 'Agenda') carregarAgenda();
    } else alert('❌ Erro: ' + res.mensagem);
}

// Edição Simplificada via Caixa de Diálogo (Apenas para ajustar valores errados sem precisar apagar)
window.editarValor = async function(id, valorAntigo) {
    const novoValor = prompt('Corrija o VALOR deste lançamento (Use ponto para os centavos. Ex: 150.50):', valorAntigo);
    if (!novoValor || novoValor === valorAntigo) return;

    // Buscar a linha completa no banco primeiro para não perder os outros dados
    const lancamentos = await buscarDados('Lancamentos');
    const lancamento = lancamentos.find(l => l.ID === id);
    
    if (lancamento) {
        // Atualiza apenas o valor
        const dadosAtualizados = [lancamento.Data, lancamento.Tipo, lancamento.Descricao, lancamento.Categoria, novoValor, lancamento.Status];
        const res = await enviarParaBanco('alterar', 'Lancamentos', dadosAtualizados, id);
        if (res.status === 'sucesso') {
            alert('✅ Valor atualizado com sucesso!');
            carregarPainelFinanceiro();
        } else {
            alert('❌ Erro ao atualizar: ' + res.mensagem);
        }
    }
}
