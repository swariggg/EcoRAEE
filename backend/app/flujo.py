"""Flujo máximo y corte mínimo con Edmonds-Karp (RF-MD-04, RF-INT-04).

La API lee la red de la base (vista vw_red), ejecuta el algoritmo y guarda el
resultado con sp_guardar_resultado_flujo (el trigger valida RN-05).
"""
from collections import deque


def edmonds_karp(aristas, s, t):
    """aristas: lista de (u, v, capacidad). Devuelve (flujo_total, flujo_por_arista, corte, caminos)."""
    cap, ady = {}, {}
    for u, v, c in aristas:
        cap[(u, v)] = cap.get((u, v), 0) + c
        cap.setdefault((v, u), 0)              # arista residual de regreso
        ady.setdefault(u, set()).add(v)
        ady.setdefault(v, set()).add(u)
    ady.setdefault(s, set())
    ady.setdefault(t, set())
    flujo = {k: 0 for k in cap}
    total, caminos = 0, []
    while True:
        # BFS: camino más corto (en número de aristas) con capacidad residual > 0
        padre = {s: None}
        cola = deque([s])
        while cola and t not in padre:
            u = cola.popleft()
            for v in sorted(ady[u]):
                if v not in padre and cap[(u, v)] - flujo[(u, v)] > 0:
                    padre[v] = u
                    cola.append(v)
        if t not in padre:
            break
        camino, v = [], t
        while padre[v] is not None:
            camino.append((padre[v], v))
            v = padre[v]
        camino.reverse()
        b = min(cap[e] - flujo[e] for e in camino)   # cuello de botella del camino
        for u, v in camino:
            flujo[(u, v)] += b
            flujo[(v, u)] -= b
        total += b
        caminos.append({"nodos": [camino[0][0]] + [v for _, v in camino], "aumento": b})
    # Corte mínimo: lado T = nodos que todavía pueden llegar a t en la red residual
    # (corte más cercano al sumidero, igual que en el documento de Discreta).
    lado_t, cola = {t}, deque([t])
    while cola:
        v = cola.popleft()
        for u in ady[v]:
            if u not in lado_t and cap[(u, v)] - flujo[(u, v)] > 0:
                lado_t.add(u)
                cola.append(u)
    corte = {(u, v) for u, v, _ in aristas if u not in lado_t and v in lado_t}
    por_arista = {(u, v): max(flujo[(u, v)], 0) for u, v, _ in aristas}
    return total, por_arista, corte, caminos
