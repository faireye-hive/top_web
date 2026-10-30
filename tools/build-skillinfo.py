#!/usr/bin/env python3
"""Converte tabelas TOP para metadados estáticos sem EXECUTAR Lua.
Uso: python3 tools/build-skillinfo.py
O navegador lê assets/skills/historical.json; as tabelas-fontes estão em
assets/skills/historical/source/ (mantidas intactas).
"""
from pathlib import Path
import ast
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/skills/historical/source'
OUT = ROOT / 'assets/skills/historical.json'


def read(name):
    return (SRC / name).read_bytes().decode('latin-1')


class NotNumeric(Exception):
    pass


def numeric_expr(expr, sklv):
    """Avaliação restrita de operações numéricas, nunca eval/exec ou interpretador Lua."""
    tree = ast.parse(expr.strip(), mode='eval')
    def walk(node):
        if isinstance(node, ast.Constant) and type(node.value) in (float, int):
            return node.value
        if isinstance(node, ast.Name) and node.id == 'sklv':
            return sklv
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            a = walk(node.operand)
            return a if isinstance(node.op, ast.UAdd) else -a
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod)):
            a, b = walk(node.left), walk(node.right)
            return {ast.Add: lambda: a+b, ast.Sub: lambda: a-b, ast.Mult: lambda: a*b,
                    ast.Div: lambda: a/b, ast.FloorDiv: lambda: a//b, ast.Mod: lambda: a%b}[type(node.op)]()
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name) and node.func.value.id == 'math' and node.func.attr in ('floor', 'ceil', 'abs'):
            import math
            if len(node.args) != 1 or node.keywords: raise NotNumeric()
            return {'floor': math.floor, 'ceil': math.ceil, 'abs': abs}[node.func.attr](walk(node.args[0]))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in ('min', 'max', 'abs'):
            if not node.args or node.keywords: raise NotNumeric()
            return {'min': min, 'max': max, 'abs': abs}[node.func.id](*[walk(x) for x in node.args])
        raise NotNumeric()
    result = walk(tree.body)
    if not isinstance(result, (int, float)) or not (-1e12 < result < 1e12): raise NotNumeric()
    return round(result, 6)


def functions(lua):
    # Scan de assinaturas e corpos simples de função, conservador: não tenta
    # adivinhar resultados de if/for/calls dependentes de atributos do servidor.
    pat = re.compile(r'(?m)^\s*function\s+(\w+)\s*\(([^)]*)\)')
    found = {}
    matches = list(pat.finditer(lua))
    for i, m in enumerate(matches):
        body_all = lua[m.end():matches[i+1].start() if i+1 < len(matches) else len(lua)]
        # Guarda somente até o primeiro 'end' isolado; casos complexos ficam como não-resolvidos.
        body = re.split(r'(?m)^\s*end\s*(?:--[^\n]*)?$', body_all, maxsplit=1)[0].strip()
        found[m.group(1)] = body
    return found


def formula(source, defs, unit=None):
    raw = str(source or '').strip()
    r = {'raw': raw, 'kind': 'indefinido', 'source': 'skillinfo.txt'}
    if not raw or raw in ('0', '-1'):
        r['kind'] = 'sem_valor'
        return r
    if re.fullmatch(r'-?\d+(?:\.\d+)?', raw):
        r['kind'] = 'constante'
        r['values'] = [float(raw)] * 10
    elif re.fullmatch(r'[A-Za-z_][\w]*', raw):
        r['function'] = raw
        r['source'] = 'skilleffect.lua'
        body = defs.get(raw)
        if body is None:
            r['kind'] = 'funcao_nao_encontrada'
            return r
        r['kind'] = 'lua_complexo'
        r['body'] = body[:800]
        # Somente atribuições locais puramente numéricas, terminadas em return.
        stmts = [re.sub(r'--.*$', '', x).strip() for x in body.splitlines()]
        stmts = [x for x in stmts if x]
        env = {}
        assignments = []
        result = None
        for line in stmts:
            m = re.fullmatch(r'(?:local\s+)?(\w+)\s*=\s*(.+)', line)
            if m:
                assignments.append((m.group(1), m.group(2)))
                continue
            m = re.fullmatch(r'return\s+(.+)', line)
            if m and result is None:
                result = m.group(1)
                continue
            return r
        if result is None: return r
        try:
            vals = []
            for level in range(1, 11):
                env.clear()
                for name, expression in assignments:
                    expanded = expression
                    for var, value in env.items():
                        expanded = re.sub(r'\b' + re.escape(var) + r'\b', '('+str(value)+')', expanded)
                    env[name] = numeric_expr(expanded, level)
                expanded = result
                for var, value in env.items():
                    expanded = re.sub(r'\b' + re.escape(var) + r'\b', '('+str(value)+')', expanded)
                vals.append(numeric_expr(expanded, level))
            r['kind'] = 'lua_estatico'
            r['values'] = vals
        except (ValueError, SyntaxError, ZeroDivisionError, NotNumeric, OverflowError):
            pass
    else:
        r['kind'] = 'expressao_nao_avaliada'
    if unit:
        r['unit'] = unit
    return r


def cols(path):
    lines = read(path).splitlines()
    header = lines[0].lstrip('/').split('\t')
    entries = []
    invalid = []
    for line_num, line in enumerate(lines[1:], 2):
        if not line.strip() or line.lstrip().startswith('//'):
            continue
        fields = line.split('\t')
        if len(fields) != len(header):
            invalid.append({'line': line_num, 'columns': len(fields)})
            continue
        entries.append(fields)
    return header, entries, invalid


def run():
    header, rows, invalid = cols('skillinfo.txt')
    if len(header) < 70 or invalid:
        raise SystemExit('Tamanho inesperado de skillinfo.txt: '+str(invalid[:5]))
    lua = functions(read('skilleffect.lua'))
    skills = {}
    def val(row, index): return row[index].strip()
    for row in rows:
        sid = str(int(row[0]))
        if sid in skills:
            raise SystemExit('ID duplicado: ' + sid)
        sk = {
            'id': int(sid), 'name': val(row, 1),
            'cooldown': formula(val(row, 44), lua, 'ms'),
            'sp': formula(val(row, 24), lua, 'SP'),
            'discharge': formula(val(row, 43), lua, 'ms'),
            'statusDuration': {'self': val(row, 36), 'target': val(row, 39)},
            'animation': {
                'baseAction': val(row, 47), 'keyframe': val(row, 48),
                'playAction': val(row, 46), 'playCount': val(row, 68)},
            'visual': {
                'actorEffect': val(row, 51), 'actorDummy': val(row, 50),
                'itemEffect': val(row, 54), 'itemEffect2': val(row, 55), 'itemDummy': val(row, 53),
                'flightEffect': val(row, 59), 'flightSpeedRaw': val(row, 60),
                'flightKeyframe': val(row, 56), 'flightDummy': val(row, 57),
                'targetEffect': val(row, 63), 'targetDummy': val(row, 62),
                'groundEffect': val(row, 65), 'durationPoint': val(row, 64)},
            'rangeRaw': val(row, 16),
            'description': val(row, 70),
            'icon': val(row, 67),
            'skillPhase': val(row, 8),
        }
        # SP às vezes vem no campo com '0', enquanto a lógica de servidor
        # usa função SkillSp_* chamada por Skill_*_Begin: apenas vinculamos
        # se a função começar com o mesmo sufixo da função de cooldown.
        cdname = sk['cooldown'].get('function', '')
        if cdname.startswith('SkillCooldown_'):
            spname = 'SkillSp_' + cdname[len('SkillCooldown_'):]
            if spname in lua:
                sk['spLua'] = formula(spname, lua, 'SP')
        skills[sid] = sk
    sh, states, si = cols('skilleff.txt')
    state_map = {str(int(r[0])): {'name': r[1], 'triggerIntervalRaw': r[2], 'effectDurationRaw': r[3]} for r in states if r[0].isdigit()}
    out = {'version': 1, 'title': 'TOP SkillInfo + SkillEffect: metadados estáticos',
           'provenance': {'skillinfo': 'assets/skills/historical/source/skillinfo.txt',
                          'lua': 'assets/skills/historical/source/skilleffect.lua',
                          'state': 'assets/skills/historical/source/skilleff.txt',
                          'note': 'Lua nunca é executado. Apenas fórmulas numéricas sem condicionais podem ser calculadas.',
                          'cooldownUnit': 'milissegundos; funções SkillCooldown_* e campos numéricos da coluna 44'},
           'counts': {'skills': len(skills), 'luaFunctions': len(lua), 'states': len(state_map)},
           'skills': skills, 'states': state_map}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0)+'\n', encoding='utf8')
    print('Criado', OUT, 'skills', len(skills), 'Lua resolvidos', sum(s['cooldown']['kind']=='lua_estatico' for s in skills.values()), 'estados', len(state_map))

if __name__ == '__main__':
    run()
