#!/usr/bin/env python3
"""Gera src/styles/escuro-cores.css: a versão escura das cores fixas (bg-[#...], text-[#...])
usadas nas telas. Rodar de novo depois de usar uma cor fixa nova:
    python3 scripts/gerar-tema-escuro.py
Fundos claros viram tons escuros do mesmo matiz; textos escuros viram claros; bordas claras
viram linhas escuras. Cores médias (laranja, verde, vermelho) ficam como estão."""
import colorsys, pathlib, re

raiz = pathlib.Path(__file__).resolve().parent.parent
padrao = re.compile(r"((?:hover:|focus:|group-hover:)?)(!?)(bg|text|border|from|to|via|ring|divide|placeholder:text)-\[#([0-9a-fA-F]{3,8})\](?:/([0-9]+))?")

def rgb(h):
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

def hexa(r, g, b, a=None):
    base = '#%02x%02x%02x' % tuple(round(max(0, min(1, x)) * 255) for x in (r, g, b))
    return base if a is None else 'rgba(%d, %d, %d, %.2f)' % (round(r * 255), round(g * 255), round(b * 255), a)

def escuro(prop, h, alfa):
    r, g, b = rgb(h)
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    fundo = prop in ('bg', 'from', 'to', 'via')
    linha = prop in ('border', 'ring', 'divide')
    texto = prop in ('text', 'placeholder:text')
    if (fundo or linha) and l > 0.72:
        alvo = (0.11 + (1 - l) * 0.85) if fundo else (0.22 + (1 - l) * 0.35)
        n = colorsys.hls_to_rgb(hh, min(alvo, 0.32), min(s, 0.45))
    elif texto and l < 0.5:
        n = colorsys.hls_to_rgb(hh, max(0.7, min(0.9, 1.08 - l)), min(s, 0.6))
    else:
        return None
    return hexa(*n, a=(int(alfa) / 100) if alfa else None)

def seletor(variante, imp, prop, h, alfa):
    nome = f"{variante}{imp}{prop}-[#{h}]" + (f"/{alfa}" if alfa else '')
    esc = re.sub(r"([:\[\]#/.!])", r"\\\1", nome)
    pseudo = ':hover' if variante in ('hover:', 'group-hover:') else ':focus' if variante == 'focus:' else ''
    if variante == 'group-hover:':
        return f":root.escuro .group:hover .{esc}"
    if prop == 'placeholder:text':
        return f":root.escuro .{esc}::placeholder"
    return f":root.escuro .{esc}{pseudo}"

usadas = set()
for arq in [*(raiz / 'src').rglob('*.tsx'), *(raiz / 'src').rglob('*.ts')]:
    for m in padrao.finditer(arq.read_text(encoding='utf-8')):
        usadas.add(m.groups())

regras = []
for variante, imp, prop, h, alfa in sorted(usadas):
    cor = escuro(prop, h, alfa)
    if not cor: continue
    sel = seletor(variante, imp, prop, h, alfa)
    if imp: cor += ' !important'
    if prop in ('from', 'to', 'via'):
        decl = f"--tw-gradient-{prop}: {cor}"
    elif prop in ('bg',):
        decl = f"background-color: {cor}"
    elif prop in ('text', 'placeholder:text'):
        decl = f"color: {cor}"
    elif prop == 'ring':
        decl = f"--tw-ring-color: {cor}"
    elif prop == 'divide':
        sel = sel + ' > :not(:last-child)'
        decl = f"border-color: {cor}"
    else:
        decl = f"border-color: {cor}"
    regras.append(f"{sel} {{ {decl}; }}")

saida = raiz / 'src/styles/escuro-cores.css'
saida.write_text('/* Gerado por scripts/gerar-tema-escuro.py. Não editar à mão. */\n' + '\n'.join(regras) + '\n', encoding='utf-8')
print(f'{len(regras)} regras em {saida.relative_to(raiz)}')
