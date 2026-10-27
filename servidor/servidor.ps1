# Tela Viva - servidor do professor
#
# Serve a página da Tela Viva para os computadores do laboratório e faz a
# ponte entre os pedidos dos alunos e a API da Anthropic, com a chave que
# fica só neste computador (servidor/chave.txt).
#
# Como usar: dois cliques em iniciar.bat. O Windows pede permissão de
# administrador para abrir a porta no firewall; a regra é removida ao sair.
# Para encerrar: Ctrl+C na janela.
#
# Arquivos desta pasta:
#   config.json       porta, modelo, limite de tokens
#   chave.txt         a chave da API (não vai para o repositório)
#   INSTRUCAO-IA.md   o que a IA deve fazer (edite à vontade)
#   registro.jsonl    tudo o que foi pedido e respondido, uma linha por evento

param([int]$Porta = 0)

$ErrorActionPreference = 'Stop'
$pasta = Split-Path -Parent $PSCommandPath
$raiz = Split-Path -Parent $pasta
$grupo = 'Tela Viva - servidor'

# ------------------------------------------------------------ configuração
$config = @{ porta = 8000; modelo = 'claude-sonnet-5-5'; maxTokens = 2500; chave = 'chave.txt'; registro = 'registro.jsonl' }
$arqConfig = Join-Path $pasta 'config.json'
if (Test-Path $arqConfig) {
    $lido = Get-Content $arqConfig -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $lido.PSObject.Properties) { $config[$p.Name] = $p.Value }
}
if ($Porta -gt 0) { $config.porta = $Porta }
$Porta = [int]$config.porta

$arqChave = Join-Path $pasta $config.chave
$chave = $null
$motivoSemIA = ''
if (Test-Path $arqChave) {
    $chave = (Get-Content $arqChave -Raw -Encoding UTF8).Trim()
    if (-not $chave.StartsWith('sk-ant-')) { $chave = $null; $motivoSemIA = 'O arquivo chave.txt não contém uma chave válida (ela começa com sk-ant-).' }
} else {
    $motivoSemIA = 'Não há arquivo servidor/chave.txt neste computador.'
}

$arqInstrucao = Join-Path $pasta 'INSTRUCAO-IA.md'
$arqFirmware = Join-Path $raiz 'FIRMWARE.md'
$arqRegistro = Join-Path $pasta $config.registro
$arqColetivo = Join-Path $pasta 'coletivo.json'

# ------------------------------------------------------------ administrador
$identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal $identidade
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Pedindo permissão de administrador (para abrir a porta no firewall)...'
    $argumentos = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-File', ('"' + $PSCommandPath + '"'), '-Porta', "$Porta")
    try { Start-Process powershell.exe -Verb RunAs -ArgumentList $argumentos -ErrorAction Stop }
    catch { Write-Host 'A permissão foi negada.' -ForegroundColor Red; Read-Host 'Aperte Enter para fechar' }
    return
}
$Host.UI.RawUI.WindowTitle = "Tela Viva - servidor (porta $Porta)"

# ------------------------------------------------------------ endereços e firewall
$enderecos = @()
foreach ($cfg in @(Get-NetIPConfiguration -ErrorAction SilentlyContinue)) {
    if ($cfg.IPv4DefaultGateway -and $cfg.IPv4Address) { foreach ($a in @($cfg.IPv4Address)) { $enderecos += $a.IPAddress } }
}
$enderecoAlunos = if ($enderecos.Count) { 'http://{0}:{1}' -f $enderecos[0], $Porta } else { "http://(endereço não encontrado):$Porta" }

Remove-NetFirewallRule -Group $grupo -ErrorAction SilentlyContinue
try { New-NetFirewallRule -DisplayName "$grupo (porta $Porta)" -Group $grupo -Direction Inbound -Protocol TCP -LocalPort $Porta -Action Allow -Profile Any -ErrorAction Stop | Out-Null; $regraOk = $true }
catch { $regraOk = $false; $erroRegra = $_.Exception.Message }

# ------------------------------------------------------------ HTTP para a API
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http
$http = New-Object System.Net.Http.HttpClient
$http.Timeout = [TimeSpan]::FromSeconds(90)

function Instrucao {
    $texto = if (Test-Path $arqInstrucao) { Get-Content $arqInstrucao -Raw -Encoding UTF8 } else { 'Traduza o pedido em um plano JavaScript usando só o firmware. Responda em JSON com titulo, entendi, escolhas, codigo, alternativas, pergunta.' }
    $fw = if (Test-Path $arqFirmware) { Get-Content $arqFirmware -Raw -Encoding UTF8 } else { '' }
    return $texto.Replace('(O arquivo FIRMWARE.md é acrescentado aqui pelo servidor.)', $fw)
}

function Registrar($obj) {
    try {
        $obj | Add-Member -NotePropertyName quando -NotePropertyValue (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss') -Force
        $linha = ConvertTo-Json -InputObject $obj -Depth 6 -Compress
        [IO.File]::AppendAllText($arqRegistro, $linha + "`n", (New-Object Text.UTF8Encoding $false))
    } catch { }
}

# Extrai o JSON da resposta da IA, mesmo que venha com cercas ou texto em volta.
function ExtrairPlano([string]$texto) {
    $t = $texto.Trim()
    $t = [regex]::Replace($t, '^```(?:json)?\s*', '')
    $t = [regex]::Replace($t, '\s*```$', '')
    $i = $t.IndexOf('{'); $j = $t.LastIndexOf('}')
    if ($i -lt 0 -or $j -le $i) { throw 'a resposta da IA não trouxe um objeto JSON' }
    $obj = $t.Substring($i, $j - $i + 1) | ConvertFrom-Json
    $plano = [ordered]@{
        titulo = [string]$obj.titulo; entendi = [string]$obj.entendi; codigo = [string]$obj.codigo; pergunta = [string]$obj.pergunta
        escolhas = @(); alternativas = @()
    }
    if ($obj.escolhas) { $plano.escolhas = @($obj.escolhas | ForEach-Object { [string]$_ }) }
    if ($obj.alternativas) { $plano.alternativas = @($obj.alternativas | ForEach-Object { [string]$_ }) }
    return $plano
}

function MontarMensagem($pedido) {
    $partes = New-Object System.Collections.ArrayList
    if ($pedido.contexto) { [void]$partes.Add("CONTEXTO (estado atual da tela e da peça):`n" + (ConvertTo-Json -InputObject $pedido.contexto -Depth 5)) }
    if ($pedido.conversa -and @($pedido.conversa).Count) {
        $hist = @($pedido.conversa) | ForEach-Object { "Pedido anterior: $($_.pedido)`nEntendi: $($_.entendi)`nCódigo entregue:`n$($_.codigo)" }
        [void]$partes.Add("CONVERSA ANTERIOR (o novo pedido é um ajuste sobre o último código):`n" + ($hist -join "`n---`n"))
    }
    [void]$partes.Add("PEDIDO DA DUPLA:`n" + [string]$pedido.pedido)
    [void]$partes.Add('Responda só com o objeto JSON.')
    return ($partes -join "`n`n")
}

# Começa a chamada à API sem esperar por ela; o laço principal recolhe a resposta.
function IniciarTraducao($ctx, $pedido) {
    $corpo = [ordered]@{
        model = $config.modelo; max_tokens = [int]$config.maxTokens
        system = (Instrucao)
        messages = @(@{ role = 'user'; content = (MontarMensagem $pedido) })
    }
    $json = ConvertTo-Json -InputObject $corpo -Depth 6
    $req = New-Object System.Net.Http.HttpRequestMessage ([System.Net.Http.HttpMethod]::Post, 'https://api.anthropic.com/v1/messages')
    $req.Headers.Add('x-api-key', $chave)
    $req.Headers.Add('anthropic-version', '2023-06-01')
    $req.Content = New-Object System.Net.Http.StringContent ($json, [Text.Encoding]::UTF8, 'application/json')
    $tarefa = $http.SendAsync($req)
    return [pscustomobject]@{ ctx = $ctx; tarefa = $tarefa; pedido = $pedido; inicio = Get-Date; ip = $ctx.Request.RemoteEndPoint.Address.ToString() }
}

function ConcluirTraducao($t) {
    $ctx = $t.ctx
    try {
        $resp = $t.tarefa.Result
        $texto = $resp.Content.ReadAsStringAsync().Result
        if (-not $resp.IsSuccessStatusCode) {
            $detalhe = try { ($texto | ConvertFrom-Json).error.message } catch { $texto }
            throw "a API respondeu $([int]$resp.StatusCode): $detalhe"
        }
        $dados = $texto | ConvertFrom-Json
        $conteudo = ($dados.content | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join "`n"
        $plano = ExtrairPlano $conteudo
        $segundos = [math]::Round(((Get-Date) - $t.inicio).TotalSeconds, 1)
        Registrar ([pscustomobject]@{ evento = 'traduzido'; ip = $t.ip; peca = $t.pedido.contexto.peca.nome; pedido = $t.pedido.pedido; plano = $plano; modelo = $config.modelo; segundos = $segundos; tokens = $dados.usage })
        Write-Host ('  {0}  {1,-15} {2,-10} {3}s  "{4}" -> {5}' -f (Get-Date -Format 'HH:mm:ss'), $t.ip, $t.pedido.contexto.peca.nome, $segundos, (Recortar $t.pedido.pedido 48), $plano.titulo) -ForegroundColor Green
        Responder $ctx 200 'application/json; charset=utf-8' (ConvertTo-Json -InputObject ([ordered]@{ ok = $true; plano = $plano }) -Depth 5 -Compress)
    } catch {
        $msg = $_.Exception.Message
        if ($_.Exception.InnerException) { $msg = $_.Exception.InnerException.Message }
        Registrar ([pscustomobject]@{ evento = 'erro'; ip = $t.ip; pedido = $t.pedido.pedido; erro = $msg })
        Write-Host ('  {0}  {1,-15} ERRO: {2}' -f (Get-Date -Format 'HH:mm:ss'), $t.ip, $msg) -ForegroundColor Red
        Responder $ctx 502 'application/json; charset=utf-8' (ConvertTo-Json -InputObject @{ ok = $false; erro = $msg } -Compress)
    }
}

function Recortar([string]$s, [int]$n) { if ($s.Length -le $n) { return $s } else { return $s.Substring(0, $n - 1) + '…' } }


# ------------------------------------------------------------ tela coletiva
$PALETA = @('#d64541', '#e5822f', '#d4a514', '#7ba32a', '#2a9d5a', '#17999a', '#2f7ad0', '#4b52c6', '#8a49c3', '#c4489a', '#8b5a3a', '#56687a', '#e0698a', '#3f8f7a', '#b06a2b', '#6b7c2a')
$coletivo = [ordered]@{ versao = 1; larg = 200; alt = 120; pecas = @(); camadas = @() }
if ($config.largura) { $coletivo.larg = [int]$config.largura }
if ($config.altura) { $coletivo.alt = [int]$config.altura }
if (Test-Path $arqColetivo) {
    try {
        $lido = Get-Content $arqColetivo -Raw -Encoding UTF8 | ConvertFrom-Json
        $coletivo.versao = [int]$lido.versao; $coletivo.larg = [int]$lido.larg; $coletivo.alt = [int]$lido.alt
        $coletivo.pecas = @($lido.pecas); $coletivo.camadas = @($lido.camadas)
    } catch { Write-Host "  Não consegui ler coletivo.json: $($_.Exception.Message)" -ForegroundColor Red }
}
function GuardarColetivo {
    try { [IO.File]::WriteAllText($arqColetivo, (ConvertTo-Json -InputObject $coletivo -Depth 8), (New-Object Text.UTF8Encoding $false)) } catch { }
}
function JsonColetivo { return (ConvertTo-Json -InputObject $coletivo -Depth 8 -Compress) }

# Posição inicial da i-ésima peça: espalhadas numa malha 5 x 4.
function PosicaoInicial([int]$i) {
    $col = $i % 5; $lin = [math]::Floor($i / 5) % 4
    return @{ x = [int][math]::Floor($coletivo.larg * ($col + 0.5) / 5); y = [int][math]::Floor($coletivo.alt * ($lin + 0.5) / 4) }
}

function Entrar($nome) {
    $nome = ([string]$nome).Trim()
    if ($nome.Length -gt 24) { $nome = $nome.Substring(0, 24) }
    if (-not $nome) { return $null }
    $existente = @($coletivo.pecas | Where-Object { $_.nome -eq $nome })
    if ($existente.Count) { return $existente[0] }
    $i = $coletivo.pecas.Count
    $pos = PosicaoInicial $i
    $peca = [pscustomobject]@{ id = ('p' + ($i + 1)); nome = $nome; cor = $PALETA[$i % $PALETA.Count]; x = $pos.x; y = $pos.y }
    $coletivo.pecas = @($coletivo.pecas) + @($peca)
    $coletivo.versao++
    GuardarColetivo
    return $peca
}

function AcrescentarCamada($dados, $ip) {
    $peca = @($coletivo.pecas | Where-Object { $_.id -eq [string]$dados.peca })
    if (-not $peca.Count) { return $null }
    $n = $coletivo.camadas.Count + 1
    $codigo = [string]$dados.codigo
    if ($codigo.Length -gt 20000) { return $null }
    $camada = [pscustomobject]@{
        n = $n; peca = $peca[0].id; autor = $peca[0].nome
        titulo = (Recortar ([string]$dados.titulo) 80); pedido = (Recortar ([string]$dados.pedido) 1500)
        entendi = (Recortar ([string]$dados.entendi) 600); escolhas = @($dados.escolhas | ForEach-Object { Recortar ([string]$_) 300 })
        codigo = $codigo; semente = $n * 7919; quando = (Get-Date -Format 'HH:mm:ss'); ip = $ip
    }
    $coletivo.camadas = @($coletivo.camadas) + @($camada)
    $coletivo.versao++
    GuardarColetivo
    return $camada
}

function RemoverCamada([int]$n, [string]$pecaId, [bool]$local) {
    $alvo = @($coletivo.camadas | Where-Object { [int]$_.n -eq $n })
    if (-not $alvo.Count) { return 'não há camada com esse número' }
    if (-not $local -and $alvo[0].peca -ne $pecaId) { return 'só quem fez a camada (ou o professor) pode removê-la' }
    $coletivo.camadas = @($coletivo.camadas | Where-Object { [int]$_.n -ne $n })
    $k = 0
    foreach ($c in $coletivo.camadas) { $k++; $c.n = $k }
    $coletivo.versao++
    GuardarColetivo
    return $null
}

# ------------------------------------------------------------ servidor de arquivos
$tipos = @{ '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.md' = 'text/markdown; charset=utf-8'; '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon' }

function Responder($ctx, [int]$status, [string]$tipo, [string]$corpo) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($corpo)
    ResponderBytes $ctx $status $tipo $bytes
}
function ResponderBytes($ctx, [int]$status, [string]$tipo, [byte[]]$bytes) {
    try {
        $ctx.Response.StatusCode = $status
        $ctx.Response.ContentType = $tipo
        $ctx.Response.Headers.Add('Cache-Control', 'no-store')
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $ctx.Response.OutputStream.Close()
    } catch { }
}

function LerCorpo($req) {
    $leitor = New-Object System.IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
    $s = $leitor.ReadToEnd(); $leitor.Close(); return $s
}

function ServirArquivo($ctx, [string]$caminho) {
    if ($caminho -eq '/') { $caminho = '/index.html' }
    $rel = $caminho.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    if ($rel -match '\.\.' -or $rel -like 'servidor*') { Responder $ctx 404 'text/plain; charset=utf-8' 'Não encontrado.'; return }
    $arq = Join-Path $raiz $rel
    if (-not (Test-Path $arq -PathType Leaf)) { Responder $ctx 404 'text/plain; charset=utf-8' 'Não encontrado.'; return }
    $ext = [IO.Path]::GetExtension($arq).ToLower()
    $tipo = if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { 'application/octet-stream' }
    ResponderBytes $ctx 200 $tipo ([IO.File]::ReadAllBytes($arq))
}

$pendentes = New-Object System.Collections.ArrayList
$visitas = @{}

function Atender($ctx) {
    $req = $ctx.Request
    $caminho = $req.Url.AbsolutePath
    $ip = $req.RemoteEndPoint.Address.ToString()
    if ($req.HttpMethod -eq 'GET' -and $caminho -eq '/ia/estado') {
        $estado = [ordered]@{ ligada = ($null -ne $chave); modelo = $config.modelo; motivo = $motivoSemIA; pendentes = $pendentes.Count; professor = $req.IsLocal }
        Responder $ctx 200 'application/json; charset=utf-8' (ConvertTo-Json -InputObject $estado -Compress)
    }
    elseif ($req.HttpMethod -eq 'POST' -and $caminho -eq '/ia/traduzir') {
        if (-not $chave) { Responder $ctx 503 'application/json; charset=utf-8' (ConvertTo-Json @{ ok = $false; erro = $motivoSemIA } -Compress); return }
        $pedido = $null
        try { $pedido = (LerCorpo $req) | ConvertFrom-Json } catch { }
        if (-not $pedido -or -not $pedido.pedido) { Responder $ctx 400 'application/json; charset=utf-8' '{"ok":false,"erro":"pedido vazio"}'; return }
        $texto = ([string]$pedido.pedido).Trim()
        if ($texto.Length -gt 1500) { $texto = $texto.Substring(0, 1500) }
        $pedido.pedido = $texto
        Write-Host ('  {0}  {1,-15} {2,-10} pediu: "{3}"' -f (Get-Date -Format 'HH:mm:ss'), $ip, $pedido.contexto.peca.nome, (Recortar $texto 60)) -ForegroundColor Cyan
        Registrar ([pscustomobject]@{ evento = 'pedido'; ip = $ip; peca = $pedido.contexto.peca.nome; pedido = $texto })
        [void]$pendentes.Add((IniciarTraducao $ctx $pedido))
    }
    elseif ($caminho -eq '/coletivo/estado') {
        $desde = 0
        try { $desde = [int]$req.QueryString['versao'] } catch { }
        if ($desde -eq $coletivo.versao) { Responder $ctx 200 'application/json; charset=utf-8' ('{"versao":' + $coletivo.versao + ',"igual":true}') }
        else { Responder $ctx 200 'application/json; charset=utf-8' (JsonColetivo) }
    }
    elseif ($req.HttpMethod -eq 'POST' -and $caminho -eq '/coletivo/entrar') {
        $dados = $null; try { $dados = (LerCorpo $req) | ConvertFrom-Json } catch { }
        $peca = if ($dados) { Entrar $dados.nome } else { $null }
        if (-not $peca) { Responder $ctx 400 'application/json; charset=utf-8' '{"ok":false,"erro":"a dupla precisa de um nome"}'; return }
        Write-Host ('  {0}  {1,-15} entrou na tela coletiva como "{2}"' -f (Get-Date -Format 'HH:mm:ss'), $ip, $peca.nome) -ForegroundColor Magenta
        Registrar ([pscustomobject]@{ evento = 'entrou'; ip = $ip; peca = $peca.nome })
        Responder $ctx 200 'application/json; charset=utf-8' (ConvertTo-Json -InputObject @{ ok = $true; peca = $peca; versao = $coletivo.versao } -Depth 4 -Compress)
    }
    elseif ($req.HttpMethod -eq 'POST' -and $caminho -eq '/coletivo/camada') {
        $dados = $null; try { $dados = (LerCorpo $req) | ConvertFrom-Json } catch { }
        $camada = if ($dados) { AcrescentarCamada $dados $ip } else { $null }
        if (-not $camada) { Responder $ctx 400 'application/json; charset=utf-8' '{"ok":false,"erro":"camada inválida (a peça entrou na tela?)"}'; return }
        Write-Host ('  {0}  {1,-15} {2,-10} camada {3}: {4}' -f (Get-Date -Format 'HH:mm:ss'), $ip, $camada.autor, $camada.n, $camada.titulo) -ForegroundColor Green
        Registrar ([pscustomobject]@{ evento = 'camada'; ip = $ip; peca = $camada.autor; n = $camada.n; titulo = $camada.titulo; pedido = $camada.pedido; codigo = $camada.codigo })
        Responder $ctx 200 'application/json; charset=utf-8' (ConvertTo-Json -InputObject @{ ok = $true; n = $camada.n; versao = $coletivo.versao } -Compress)
    }
    elseif ($req.HttpMethod -eq 'POST' -and $caminho -eq '/coletivo/remover') {
        $dados = $null; try { $dados = (LerCorpo $req) | ConvertFrom-Json } catch { }
        $erro = if ($dados) { RemoverCamada ([int]$dados.n) ([string]$dados.peca) $req.IsLocal } else { 'pedido inválido' }
        if ($erro) { Responder $ctx 403 'application/json; charset=utf-8' (ConvertTo-Json @{ ok = $false; erro = $erro } -Compress); return }
        Write-Host ('  {0}  {1,-15} removeu a camada {2}' -f (Get-Date -Format 'HH:mm:ss'), $ip, $dados.n) -ForegroundColor DarkYellow
        Registrar ([pscustomobject]@{ evento = 'removida'; ip = $ip; n = $dados.n })
        Responder $ctx 200 'application/json; charset=utf-8' (ConvertTo-Json -InputObject @{ ok = $true; versao = $coletivo.versao } -Compress)
    }
    elseif ($req.HttpMethod -eq 'POST' -and $caminho -eq '/coletivo/zerar') {
        if (-not $req.IsLocal) { Responder $ctx 403 'application/json; charset=utf-8' '{"ok":false,"erro":"só o computador do professor pode zerar a tela"}'; return }
        $dados = $null; try { $dados = (LerCorpo $req) | ConvertFrom-Json } catch { }
        $coletivo.camadas = @()
        if ($dados -and $dados.pecas) { $coletivo.pecas = @() }
        $coletivo.versao++
        GuardarColetivo
        Write-Host ('  {0}  tela coletiva zerada' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkYellow
        Registrar ([pscustomobject]@{ evento = 'zerada'; pecas = [bool]($dados -and $dados.pecas) })
        Responder $ctx 200 'application/json; charset=utf-8' (ConvertTo-Json -InputObject @{ ok = $true; versao = $coletivo.versao } -Compress)
    }
    elseif ($req.HttpMethod -eq 'POST' -and $caminho -eq '/registro') {
        $dados = $null
        try { $dados = (LerCorpo $req) | ConvertFrom-Json } catch { }
        if ($dados) {
            $dados | Add-Member -NotePropertyName ip -NotePropertyValue $ip -Force
            Registrar $dados
            if ($dados.evento -eq 'aceito') { Write-Host ('  {0}  {1,-15} {2,-10} aceitou um plano ({3})' -f (Get-Date -Format 'HH:mm:ss'), $ip, $dados.peca, $dados.origem) -ForegroundColor DarkGreen }
        }
        Responder $ctx 200 'application/json; charset=utf-8' '{"ok":true}'
    }
    elseif ($req.HttpMethod -eq 'GET') {
        if ($caminho -eq '/' -and -not $visitas.ContainsKey($ip)) { $visitas[$ip] = 1; Write-Host ('  {0}  {1,-15} abriu a Tela' -f (Get-Date -Format 'HH:mm:ss'), $ip) -ForegroundColor Cyan }
        ServirArquivo $ctx $caminho
    }
    else { Responder $ctx 404 'text/plain; charset=utf-8' 'Não encontrado.' }
}

# ------------------------------------------------------------ início
$ouvinte = New-Object System.Net.HttpListener
$ouvinte.Prefixes.Add("http://+:$Porta/")
try { $ouvinte.Start() } catch {
    Write-Host "  Não consegui escutar na porta ${Porta}: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '  Talvez outro programa use essa porta. Mude "porta" em config.json ou rode: iniciar.bat -Porta 8080'
    Remove-NetFirewallRule -Group $grupo -ErrorAction SilentlyContinue
    return
}

Clear-Host
Write-Host ''
Write-Host '  Tela Viva - servidor do professor' -ForegroundColor White
Write-Host ''
Write-Host '  Os alunos abrem no navegador:'
Write-Host "      $enderecoAlunos                 (tela individual: cada computador tem a sua)" -ForegroundColor Yellow
Write-Host "      $enderecoAlunos/?modo=coletivo   (tela coletiva: uma só, no projetor)" -ForegroundColor Yellow
Write-Host ''
Write-Host "  Projetor (neste computador): http://localhost:$Porta/?modo=projetor"
Write-Host "  Tela coletiva: $($coletivo.larg) x $($coletivo.alt), $($coletivo.pecas.Count) peças, $($coletivo.camadas.Count) camadas (guardada em coletivo.json)"
if ($enderecos.Count -gt 1) { Write-Host ('  (outros endereços deste computador: ' + (($enderecos | Select-Object -Skip 1) -join ', ') + ')') }
Write-Host ''
if ($chave) { Write-Host "  IA: ligada, modelo $($config.modelo)" -ForegroundColor Green } else { Write-Host "  IA: desligada. $motivoSemIA" -ForegroundColor Red }
if ($regraOk) { Write-Host "  Firewall: porta $Porta liberada enquanto o servidor durar." -ForegroundColor Green } else { Write-Host "  Firewall: não consegui criar a regra ($erroRegra)." -ForegroundColor Red }
Write-Host "  Registro: $arqRegistro"
Write-Host '  Para encerrar: Ctrl+C'
Write-Host ''
Write-Host '  Movimento:' -ForegroundColor White
try { Start-Process "http://localhost:$Porta/?modo=projetor" } catch { }

try {
    while ($ouvinte.IsListening) {
        $tarefa = $ouvinte.GetContextAsync()
        while (-not $tarefa.Wait(100)) {
            # recolhe respostas da API que já chegaram
            for ($i = $pendentes.Count - 1; $i -ge 0; $i--) {
                $t = $pendentes[$i]
                if ($t.tarefa.IsCompleted) { $pendentes.RemoveAt($i); ConcluirTraducao $t }
            }
        }
        $ctx = $tarefa.Result
        try { Atender $ctx } catch {
            Write-Host "  Erro ao atender: $($_.Exception.Message)" -ForegroundColor Red
            try { Responder $ctx 500 'text/plain; charset=utf-8' 'Erro no servidor.' } catch { }
        }
    }
} finally {
    try { $ouvinte.Stop(); $ouvinte.Close() } catch { }
    Remove-NetFirewallRule -Group $grupo -ErrorAction SilentlyContinue
    Write-Host ''
    Write-Host '  Servidor parado. A regra de firewall foi removida.' -ForegroundColor White
}
