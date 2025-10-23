// js/script.js (expenseControl 0.2)

let dadosMotorista = [];
const LOCAL_STORAGE_KEY = 'controleGastosMotorista';
let graficoInstance = null;

// Variáveis para rastrear o período de filtro atual (Início com o mês/ano atual)
let mesFiltroAtual = new Date().getMonth() + 1;
let anoFiltroAtual = new Date().getFullYear();

// Referências DOM
const dashboardResumo = document.getElementById('dashboard-resumo');
const tabelaRegistrosBody = document.querySelector('#tabelaRegistros tbody');
const formReceita = document.getElementById('formReceita');
const formDespesa = document.getElementById('formDespesa');
const filtroMesSelect = document.getElementById('filtroMes');
const filtroAnoSelect = document.getElementById('filtroAno');
const aplicarFiltroButton = document.getElementById('aplicarFiltro');


// ----------------------------------------------------
// Funções de Persistência e Inicialização
// ----------------------------------------------------

function salvarDados() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dadosMotorista));
    // Atualiza os seletores de Ano sempre que novos dados são salvos
    popularFiltros();
}

function carregarDados() {
    const hoje = new Date();
    // Preenche as datas nos formulários com a data atual
    const hojeFormatado = hoje.toISOString().substring(0, 10);
    document.getElementById('dataReceita').value = hojeFormatado;
    document.getElementById('dataDespesa').value = hojeFormatado;
    
    // Carrega dados do LocalStorage
    const dadosSalvos = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (dadosSalvos) {
        dadosMotorista = JSON.parse(dadosSalvos);
    }
    
    // Configura os filtros e aplica a visualização inicial
    popularFiltros();
    aplicarFiltro();
}

function popularFiltros() {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    
    // 1. Popular Anos
    let anos = new Set();
    dadosMotorista.forEach(reg => anos.add(new Date(reg.data).getFullYear()));
    if (!anos.has(anoAtual)) anos.add(anoAtual);
    
    filtroAnoSelect.innerHTML = '';
    [...anos].sort((a, b) => b - a).forEach(ano => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        filtroAnoSelect.appendChild(option);
    });

    // 2. Popular Meses
    const nomesMeses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    filtroMesSelect.innerHTML = '';
    nomesMeses.forEach((nome, index) => {
        const option = document.createElement('option');
        option.value = index + 1; // Mês é baseado em 1 (1 para Janeiro)
        option.textContent = nome;
        filtroMesSelect.appendChild(option);
    });
    
    // Define o filtro padrão para o período atual
    filtroMesSelect.value = mesFiltroAtual;
    filtroAnoSelect.value = anoFiltroAtual;
}

function aplicarFiltro() {
    // Atualiza as variáveis de filtro com os valores selecionados
    mesFiltroAtual = parseInt(filtroMesSelect.value);
    anoFiltroAtual = parseInt(filtroAnoSelect.value);
    
    // Recarrega todos os componentes visuais com os novos filtros
    calcularEExibirTotais();
    renderizarGraficoDespesas();
    renderizarTabela();
}


// ----------------------------------------------------
// Funções de Processamento de Dados (Filtro, Cálculo, Renderização)
// ----------------------------------------------------

/**
 * Filtra os dados globais pelo Mês e Ano selecionados
 */
function filtrarDadosPorPeriodo() {
    return dadosMotorista.filter(reg => {
        // Tenta criar uma data a partir do formato YYYY-MM-DD
        const dataReg = new Date(reg.data + 'T00:00:00'); 
        if (isNaN(dataReg)) return false; // Ignora registros com datas inválidas
        
        const regMes = dataReg.getMonth() + 1;
        const regAno = dataReg.getFullYear();
        
        return regMes === mesFiltroAtual && regAno === anoFiltroAtual;
    });
}

/**
 * 4. Controle Mensal: Calcula Receita, Despesa e Saldo para o período filtrado
 */
function calcularTotais() {
    const dadosFiltrados = filtrarDadosPorPeriodo();

    const resultados = dadosFiltrados.reduce((acc, reg) => {
        if (reg.tipo === 'receita') {
            acc.receita += reg.valor;
        } else if (reg.tipo === 'despesa') {
            acc.despesa += reg.valor;
        }
        return acc;
    }, { receita: 0, despesa: 0 });

    resultados.saldo = resultados.receita - resultados.despesa;
    return resultados;
}

/**
 * Atualiza o HTML do Dashboard (Receita, Despesa, Saldo)
 */
function calcularEExibirTotais() {
    const totaisPeriodo = calcularTotais();
    const nomeMes = filtroMesSelect.options[filtroMesSelect.selectedIndex].text;
    
    dashboardResumo.innerHTML = `
        <div class="col-md-4 mb-3">
            <div class="card p-3 shadow-sm border-success bg-light">
                <h5 class="text-success"><i class="fas fa-money-check-alt"></i> Receita (${nomeMes})</h5>
                <p class="fs-4 text-success fw-bold">R$ ${totaisPeriodo.receita.toFixed(2).replace('.', ',')}</p>
            </div>
        </div>
        <div class="col-md-4 mb-3">
            <div class="card p-3 shadow-sm border-danger bg-light">
                <h5 class="text-danger"><i class="fas fa-wallet"></i> Despesa (${nomeMes})</h5>
                <p class="fs-4 text-danger fw-bold">R$ ${totaisPeriodo.despesa.toFixed(2).replace('.', ',')}</p>
            </div>
        </div>
        <div class="col-md-4 mb-3">
            <div class="card p-3 shadow-sm border-primary bg-light">
                <h5 class="text-primary"><i class="fas fa-chart-bar"></i> Saldo (${nomeMes})</h5>
                <p class="fs-4 fw-bold" style="color: ${totaisPeriodo.saldo >= 0 ? '#28a745' : '#dc3545'};">R$ ${totaisPeriodo.saldo.toFixed(2).replace('.', ',')}</p>
            </div>
        </div>
    `;
}

/**
 * 1, 2, 3. Renderiza o Histórico de Transações (Tabela filtrada)
 */
function renderizarTabela() {
    tabelaRegistrosBody.innerHTML = '';
    
    // Dados filtrados pelo período selecionado
    const dadosParaExibir = filtrarDadosPorPeriodo(); 

    const dadosOrdenados = [...dadosParaExibir].sort((a, b) => new Date(b.data) - new Date(a.data));

    if (dadosOrdenados.length === 0) {
        tabelaRegistrosBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Nenhum registro encontrado para o período selecionado.</td></tr>`;
        return;
    }

    dadosOrdenados.forEach(reg => {
        const tr = document.createElement('tr');
        const classeCor = reg.tipo === 'receita' ? 'text-success' : 'text-danger';

        const descricaoDetalhada = reg.tipo === 'receita' 
            ? `<i class="fas fa-user"></i> ${reg.cliente} - <i class="fas fa-map-marker-alt"></i> ${reg.destino}` 
            : `<i class="fas fa-tag"></i> ${reg.categoria}: ${reg.descricao}`;

        tr.innerHTML = `
            <td><i class="fas ${reg.tipo === 'receita' ? 'fa-arrow-up' : 'fa-arrow-down'} ${classeCor}"></i></td>
            <td>${descricaoDetalhada}</td>
            <td class="text-end fw-bold ${classeCor}">R$ ${reg.valor.toFixed(2).replace('.', ',')}</td>
            <td>${new Date(reg.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirRegistro(${reg.id})">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        
        // Parte clicável para detalhes
        tr.onclick = () => alert(`DETALHES DO REGISTRO:\n
Tipo: ${reg.tipo.toUpperCase()}
Valor: R$ ${reg.valor.toFixed(2).replace('.', ',')}
Data: ${new Date(reg.data + 'T00:00:00').toLocaleDateString('pt-BR')}
${reg.tipo === 'receita' ? 'Cliente: ' + reg.cliente + '\nDestino: ' + reg.destino : 'Categoria: ' + reg.categoria + '\nDescrição: ' + reg.descricao}`);

        tabelaRegistrosBody.appendChild(tr);
    });
}

function excluirRegistro(id) {
    if (confirm("Tem certeza que deseja excluir este registro?")) {
        dadosMotorista = dadosMotorista.filter(reg => reg.id !== id);
        salvarDados();
        aplicarFiltro(); // Recarrega a UI após exclusão
    }
}

/**
 * 5. Renderiza o Gráfico de Despesas (Doughnut)
 */
function renderizarGraficoDespesas() {
    const dadosFiltrados = filtrarDadosPorPeriodo().filter(reg => reg.tipo === 'despesa');
    
    const despesasPorCategoria = dadosFiltrados
        .reduce((acc, reg) => {
            acc[reg.categoria] = (acc[reg.categoria] || 0) + reg.valor;
            return acc;
        }, {});

    const labels = Object.keys(despesasPorCategoria);
    const data = Object.values(despesasPorCategoria);

    if (graficoInstance) {
        graficoInstance.destroy();
    }

    const ctx = document.getElementById('graficoDespesas').getContext('2d');
    
    // Cores fixas para as categorias
    const cores = {
        'Gasolina': '#ffcd56',
        'Pedágio': '#4bc0c0',
        'Manutenção': '#ff6384',
        'Refeição': '#36a2eb',
        'Outros': '#9966ff'
    };

    const coresFinais = labels.map(label => cores[label] || '#cccccc');

    graficoInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: coresFinais,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                },
                title: {
                    display: true,
                    text: `Despesas do Mês de ${filtroMesSelect.options[filtroMesSelect.selectedIndex].text}`
                }
            }
        }
    });
}


// ----------------------------------------------------
// Event Listeners
// ----------------------------------------------------

formReceita.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const novoRegistro = {
        id: Date.now(), 
        tipo: 'receita',
        cliente: document.getElementById('nomeCliente').value,
        destino: document.getElementById('destino').value,
        data: document.getElementById('dataReceita').value,
        valor: parseFloat(document.getElementById('valorReceita').value)
    };

    dadosMotorista.push(novoRegistro);
    salvarDados();
    // Após salvar, define o filtro para a data do novo registro e atualiza a UI
    const dataNova = new Date(novoRegistro.data);
    filtroMesSelect.value = dataNova.getMonth() + 1;
    filtroAnoSelect.value = dataNova.getFullYear();
    aplicarFiltro(); 
    this.reset();
});

formDespesa.addEventListener('submit', function(e) {
    e.preventDefault();

    const novoRegistro = {
        id: Date.now(),
        tipo: 'despesa',
        categoria: document.getElementById('tipoGasto').value,
        descricao: document.getElementById('descricaoGasto').value,
        data: document.getElementById('dataDespesa').value,
        valor: parseFloat(document.getElementById('valorDespesa').value)
    };

    dadosMotorista.push(novoRegistro);
    salvarDados();
    // Após salvar, define o filtro para a data do novo registro e atualiza a UI
    const dataNova = new Date(novoRegistro.data);
    filtroMesSelect.value = dataNova.getMonth() + 1;
    filtroAnoSelect.value = dataNova.getFullYear();
    aplicarFiltro();
    this.reset();
});

// Listener para o novo botão 'Aplicar'
aplicarFiltroButton.addEventListener('click', aplicarFiltro);

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', carregarDados);