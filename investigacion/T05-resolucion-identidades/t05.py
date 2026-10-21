"""T05 · E4 · Resolución de identidades (L1/L5, R-L1.1, R-L5.3, H1, H5.1). Protocolo: PROTOCOLO.md

Ejecutar desde esta carpeta: .venv/bin/python t05.py
"""

import gzip
import hashlib
import json
import math
import random
import subprocess
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import splink.comparison_library as cl
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from splink import DuckDBAPI, Linker, SettingsCreator, block_on

OUT = Path(__file__).parent
DATA = OUT / "datos"
SEEDS = [1, 2, 3, 4, 5]
BUDGETS = [50, 100, 199]
N_POP, N_A, N_B_SHARED, N_B_ONLY, DUP_RATE = 4000, 3000, 2000, 1000, 0.04

SCENARIOS = {
    "estandar": dict(dni_missing=0.40, dni_no_letter=0.50, dni_typo=0.03, typo=0.08, ap2_missing=0.10,
                     swap=0.03, compound_cut=0.30, dob_dm_swap=0.03, dob_typo=0.03, dob_missing=0.05),
    "dificil": dict(dni_missing=0.80, dni_no_letter=0.50, dni_typo=0.05, typo=0.15, ap2_missing=0.15,
                    swap=0.05, compound_cut=0.40, dob_dm_swap=0.05, dob_typo=0.05, dob_missing=0.10),
}

# ── Nombres y apellidos españoles frecuentes (orden aproximado de frecuencia) ──

MALE = ["Antonio", "José", "Manuel", "Francisco", "David", "Juan", "Javier", "Daniel", "Carlos", "Alejandro",
        "Miguel", "Rafael", "Pablo", "Pedro", "Sergio", "Fernando", "Jorge", "Luis", "Alberto", "Álvaro",
        "Adrián", "Diego", "Raúl", "Iván", "Rubén", "Óscar", "Enrique", "Andrés", "Ramón", "Vicente",
        "Joaquín", "Santiago", "Víctor", "Mario", "Hugo", "Marcos", "Ignacio", "Jesús", "Alfonso", "Gonzalo"]
FEMALE = ["María", "Carmen", "Ana", "Isabel", "Laura", "Cristina", "Marta", "Lucía", "Elena", "Sara",
          "Paula", "Raquel", "Rosa", "Pilar", "Beatriz", "Nuria", "Silvia", "Julia", "Irene", "Patricia",
          "Andrea", "Rocío", "Mónica", "Alba", "Sonia", "Sandra", "Marina", "Eva", "Natalia", "Claudia",
          "Alicia", "Inés", "Teresa", "Lorena", "Noelia", "Carla", "Sofía", "Esther", "Verónica", "Miriam"]
MALE_COMPOUND = ["José Antonio", "Juan Carlos", "José Luis", "Francisco Javier", "Juan José", "José Manuel",
                 "Miguel Ángel", "Juan Antonio", "José María", "Luis Miguel"]
FEMALE_COMPOUND = ["María José", "María Carmen", "Ana Belén", "María Ángeles", "María Isabel", "María Pilar",
                   "Ana María", "María Teresa", "María Jesús", "María Dolores"]
SURNAMES = ["García", "Rodríguez", "González", "Fernández", "López", "Martínez", "Sánchez", "Pérez", "Gómez",
            "Martín", "Jiménez", "Ruiz", "Hernández", "Díaz", "Moreno", "Muñoz", "Álvarez", "Romero", "Alonso",
            "Gutiérrez", "Navarro", "Torres", "Domínguez", "Vázquez", "Ramos", "Gil", "Ramírez", "Serrano",
            "Blanco", "Molina", "Morales", "Suárez", "Ortega", "Delgado", "Castro", "Ortiz", "Rubio", "Marín",
            "Sanz", "Núñez", "Iglesias", "Medina", "Garrido", "Cortés", "Castillo", "Santos", "Lozano", "Guerrero",
            "Cano", "Prieto", "Méndez", "Cruz", "Calvo", "Gallego", "Vidal", "León", "Márquez", "Herrera", "Peña",
            "Flores", "Cabrera", "Campos", "Vega", "Fuentes", "Carrasco", "Díez", "Caballero", "Reyes", "Nieto",
            "Aguilar", "Pascual", "Santana", "Herrero", "Lorenzo", "Montero", "Hidalgo", "Giménez", "Ibáñez",
            "Ferrer", "Durán", "Santiago", "Benítez", "Mora", "Vicente", "Vargas", "Arias", "Carmona", "Crespo",
            "Román", "Pastor", "Soto", "Sáez", "Velasco", "Moya", "Soler", "Parra", "Esteban", "Bravo", "Gallardo",
            "Rojas"]
COMPOUND_SURNAMES = ["de la Fuente", "del Río", "de la Torre", "García-Ruiz", "Fernández-Pacheco", "de León",
                     "de la Cruz", "Sánchez-Mateos"]
DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"


def zipf_weights(n, s=0.9):
    w = np.array([1 / (k ** s) for k in range(1, n + 1)])
    return w / w.sum()


# ── Normalización común a todos los métodos ─────────────────────────────────

def norm(s):
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return None
    s = str(s).lower().replace("mª", "maria").replace("m.ª", "maria")
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    s = s.replace("-", " ").replace(".", " ")
    s = " ".join(s.split())
    return s or None


# ── Generación ───────────────────────────────────────────────────────────────

def typo(rng, s):
    if not s or len(s) < 3:
        return s
    i = rng.randrange(1, len(s) - 1)
    op = rng.choice(["sub", "del", "swap", "dup"])
    if op == "sub":
        return s[:i] + rng.choice("abcdefghijlmnoprstuvz") + s[i + 1:]
    if op == "del":
        return s[:i] + s[i + 1:]
    if op == "swap":
        return s[:i] + s[i + 1] + s[i] + s[i + 2:]
    return s[:i] + s[i] + s[i:]


def population(rng):
    sw = zipf_weights(len(SURNAMES))
    people = []
    used_dni = set()
    for pid in range(N_POP):
        sexo = rng.choice("HM")
        if rng.random() < 0.25:
            nombre = rng.choice(MALE_COMPOUND if sexo == "H" else FEMALE_COMPOUND)
        else:
            pool = MALE if sexo == "H" else FEMALE
            nombre = pool[min(int(rng.expovariate(1 / 8)), len(pool) - 1)]

        def surname():
            if rng.random() < 0.03:
                return rng.choice(COMPOUND_SURNAMES)
            return SURNAMES[np.searchsorted(np.cumsum(sw), rng.random())]

        dob = date(1998, 1, 1) + timedelta(days=rng.randrange((date(2008, 12, 31) - date(1998, 1, 1)).days))
        n = rng.randrange(10_000_000, 80_000_000)
        while n in used_dni:
            n = rng.randrange(10_000_000, 80_000_000)
        used_dni.add(n)
        people.append(dict(person_id=pid, nombre=nombre, ap1=surname(), ap2=surname(), sexo=sexo,
                           dob=dob.isoformat(), dni=f"{n:08d}{DNI_LETTERS[n % 23]}"))
    return people


def record_a(rng, p):
    r = dict(p)
    if rng.random() < 0.02:
        f = rng.choice(["nombre", "ap1", "ap2"])
        r[f] = typo(rng, r[f])
    if rng.random() < 0.05:
        r["dni"] = None
    return r


def record_b(rng, p, c):
    r = {k: (v.upper() if isinstance(v, str) else v) for k, v in p.items()}
    r = {k: (norm(v).upper() if k in ("nombre", "ap1", "ap2") else v) for k, v in r.items()}
    if " " in p["nombre"] and rng.random() < c["compound_cut"]:
        first, rest = r["nombre"].split(" ", 1)
        r["nombre"] = rng.choice([first, f"Mª {rest}" if first == "MARIA" else first, f"{first[0]}. {rest}"])
    for f in ("nombre", "ap1", "ap2"):
        if rng.random() < c["typo"]:
            r[f] = typo(rng, r[f])
    if rng.random() < c["swap"]:
        r["ap1"], r["ap2"] = r["ap2"], r["ap1"]
    if rng.random() < c["ap2_missing"]:
        r["ap2"] = None
    d = r["dob"]
    u = rng.random()
    if u < c["dob_missing"]:
        r["dob"] = None
    elif u < c["dob_missing"] + c["dob_dm_swap"] and int(d[8:10]) <= 12:
        r["dob"] = f"{d[:4]}-{d[8:10]}-{d[5:7]}"
    elif u < c["dob_missing"] + c["dob_dm_swap"] + c["dob_typo"]:
        i = rng.choice([2, 3, 6, 9])
        r["dob"] = d[:i] + str(rng.randrange(10)) + d[i + 1:]
    if rng.random() < c["dni_missing"]:
        r["dni"] = None
    else:
        dni = r["dni"]
        if rng.random() < c["dni_typo"]:
            i = rng.randrange(8)
            dni = dni[:i] + str((int(dni[i]) + rng.randrange(1, 10)) % 10) + dni[i + 1:]
        if rng.random() < c["dni_no_letter"]:
            dni = dni[:8]
        r["dni"] = dni
    return r


def generate(scenario, seed):
    rng = random.Random(f"{scenario}-{seed}")
    c = SCENARIOS[scenario]
    people = population(rng)
    ids = list(range(N_POP))
    rng.shuffle(ids)
    in_a = ids[:N_A]
    in_b = ids[:N_B_SHARED] + ids[N_A:N_A + N_B_ONLY]
    A = [dict(unique_id=f"a{i:05d}", **record_a(rng, people[pid])) for i, pid in enumerate(in_a)]
    B = []
    for pid in in_b:
        B.append(record_b(rng, people[pid], c))
        if rng.random() < DUP_RATE:
            B.append(record_b(rng, people[pid], c))
    rng.shuffle(B)
    B = [dict(unique_id=f"b{i:05d}", **r) for i, r in enumerate(B)]
    return pd.DataFrame(A), pd.DataFrame(B)


def prepare(df):
    out = pd.DataFrame({"unique_id": df["unique_id"]})
    out["nombre"] = df["nombre"].map(norm)
    out["nombre1"] = out["nombre"].map(lambda s: s.split(" ")[0] if s else None)
    out["nombre_ini"] = out["nombre"].map(lambda s: s[0] if s else None)
    out["ap1"] = df["ap1"].map(norm)
    out["ap2"] = df["ap2"].map(norm)
    out["sexo"] = df["sexo"]
    out["dob"] = df["dob"]
    out["dni_num"] = df["dni"].map(lambda d: d[:8] if isinstance(d, str) else None)
    out["dni_letra"] = df["dni"].map(lambda d: d[8] if isinstance(d, str) and len(d) == 9 else None)
    return out


def truth_pairs(A, B):
    m = A[["unique_id", "person_id"]].merge(B[["unique_id", "person_id"]], on="person_id", suffixes=("_a", "_b"))
    return set(zip(m["unique_id_a"], m["unique_id_b"]))


# ── Métricas ─────────────────────────────────────────────────────────────────

def prf(pred, truth, exclude=frozenset()):
    pred = {p for p in pred if p not in exclude}
    truth = {p for p in truth if p not in exclude}
    tp = len(pred & truth)
    p = tp / len(pred) if pred else 0.0
    r = tp / len(truth) if truth else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return dict(precision=round(p, 4), exhaustividad=round(r, 4), f1=round(f, 4), tp=tp,
                fp=len(pred) - tp, fn=len(truth) - tp)


# ── M0 · Determinista ────────────────────────────────────────────────────────

def m0(a, b):
    by_dni = a.dropna(subset=["dni_num"]).merge(b.dropna(subset=["dni_num"]), on="dni_num", suffixes=("_a", "_b"))
    pairs = set(zip(by_dni["unique_id_a"], by_dni["unique_id_b"]))
    keys = ["nombre", "ap1", "ap2", "dob"]
    no_dni_a = a[a["dni_num"].isna()].dropna(subset=keys)
    no_dni_b = b[b["dni_num"].isna()].dropna(subset=keys)
    ex = pd.concat([
        no_dni_a.merge(b.dropna(subset=keys), on=keys, suffixes=("_a", "_b")),
        a.dropna(subset=keys).merge(no_dni_b, on=keys, suffixes=("_a", "_b")),
    ])
    return pairs | set(zip(ex["unique_id_a"], ex["unique_id_b"]))


# ── M1 · Splink ──────────────────────────────────────────────────────────────

def splink_candidates(a, b, seed):
    settings = SettingsCreator(
        link_type="link_only",
        comparisons=[
            cl.JaroWinklerAtThresholds("nombre", [0.95, 0.88]).configure(term_frequency_adjustments=True),
            cl.JaroWinklerAtThresholds("ap1", [0.95, 0.88]).configure(term_frequency_adjustments=True),
            cl.JaroWinklerAtThresholds("ap2", [0.95, 0.88]).configure(term_frequency_adjustments=True),
            cl.LevenshteinAtThresholds("dob", [1, 2]),
            cl.LevenshteinAtThresholds("dni_num", [1]),
            cl.ExactMatch("sexo"),
        ],
        blocking_rules_to_generate_predictions=[
            block_on("dob"),
            block_on("ap1", "nombre_ini"),
            block_on("dni_num"),
            block_on("ap1", "ap2"),
        ],
        additional_columns_to_retain=["nombre1", "dni_letra"],
        retain_intermediate_calculation_columns=True,
    )
    db = DuckDBAPI()
    linker = Linker([db.register(a, dataset_display_name="a"), db.register(b, dataset_display_name="b")],
                    settings, log_level=40)
    linker.training.estimate_probability_two_random_records_match(
        ["l.dni_num = r.dni_num", "l.nombre = r.nombre and l.ap1 = r.ap1 and l.ap2 = r.ap2 and l.dob = r.dob"],
        recall=0.6)
    linker.training.estimate_u_using_random_sampling(max_pairs=2e6, seed=seed)
    linker.training.estimate_parameters_using_expectation_maximisation(block_on("dob"))
    linker.training.estimate_parameters_using_expectation_maximisation(block_on("ap1", "ap2"))
    df = linker.inference.predict().as_pandas_dataframe()
    # Orientar cada par como (ficha de A, ficha de B)
    flip = df["unique_id_l"].str.startswith("b")
    for col in [c for c in df.columns if c.endswith("_l")]:
        base = col[:-2]
        if f"{base}_r" in df.columns:
            l, r = df[col].copy(), df[f"{base}_r"].copy()
            df.loc[flip, col], df.loc[flip, f"{base}_r"] = r[flip], l[flip]
    return df.drop_duplicates(subset=["unique_id_l", "unique_id_r"]).reset_index(drop=True)


# ── M3 · Variables propias ───────────────────────────────────────────────────

def features(c, ap_freq):
    X = pd.DataFrame(index=c.index)
    for g in ["gamma_nombre", "gamma_ap1", "gamma_ap2", "gamma_dob", "gamma_dni_num", "gamma_sexo"]:
        for lvl in sorted(c[g].unique()):
            X[f"{g}={lvl}"] = (c[g] == lvl).astype(float)
    X["match_weight"] = c["match_weight"].clip(-30, 30)
    eq = lambda x, y: (c[x].notna() & c[y].notna() & (c[x] == c[y])).astype(float)
    X["apellidos_intercambiados"] = (eq("ap1_l", "ap2_r") * eq("ap2_l", "ap1_r") * (c["ap1_l"] != c["ap1_r"])).astype(float)
    X["ap1_l_en_ap2_r"] = eq("ap1_l", "ap2_r")
    X["segundo_apellido_ausente"] = (c["ap2_l"].isna() | c["ap2_r"].isna()).astype(float)
    X["primer_nombre_igual"] = eq("nombre1_l", "nombre1_r")
    X["nombre_prefijo"] = [float(bool(x) and bool(y) and x != y and (x.startswith(y) or y.startswith(x)))
                           for x, y in zip(c["nombre_l"], c["nombre_r"])]
    X["nombre_inicial_resto_igual"] = [
        float(bool(x) and bool(y) and " " in x and " " in y and x.split(" ", 1)[1] == y.split(" ", 1)[1]
              and x[0] == y[0])
        for x, y in zip(c["nombre_l"], c["nombre_r"])]
    X["fecha_dia_mes_intercambiados"] = [
        float(isinstance(x, str) and isinstance(y, str) and x != y and x[:4] == y[:4] and x[5:7] == y[8:10]
              and x[8:10] == y[5:7]) for x, y in zip(c["dob_l"], c["dob_r"])]
    X["dni_igual"] = eq("dni_num_l", "dni_num_r")
    X["dni_ausente"] = (c["dni_num_l"].isna() | c["dni_num_r"].isna()).astype(float)
    X["rareza_ap1"] = c["ap1_l"].map(lambda s: -math.log(ap_freq.get(s, 1) / sum(ap_freq.values())) if s else 0)
    return X


def receipt_chain(rows, model_hash):
    prev = "0" * 64
    out = []
    for r in rows:
        body = dict(r, modelo_sha256=model_hash, anterior=prev)
        h = hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        out.append(dict(body, hash=h))
        prev = h
    return out


def active_learning(c, X, truth, seed):
    """Devuelve, para cada presupuesto, (índices etiquetados, modelo, escalador)."""
    rng = np.random.default_rng(seed)
    y_all = np.array([(a, b) in truth for a, b in zip(c["unique_id_l"], c["unique_id_r"])])
    labeled = []
    # Núcleo: 20 pares estratificados por el peso de Splink (10 tramos × 2)
    bins = pd.cut(c["match_weight"], 10, labels=False)
    for b in range(10):
        idx = np.flatnonzero(bins.to_numpy() == b)
        if len(idx):
            labeled += list(rng.choice(idx, size=min(2, len(idx)), replace=False))
    labeled = list(dict.fromkeys(labeled))[:20]
    out = {}
    scaler, model = StandardScaler(), None
    while True:
        y = y_all[labeled]
        if y.min() != y.max():
            scaler = StandardScaler().fit(X.iloc[labeled])
            model = LogisticRegression(C=1.0, max_iter=2000).fit(scaler.transform(X.iloc[labeled]), y)
        for B in BUDGETS:
            if len(labeled) == B and model is not None:
                out[B] = (list(labeled), model, scaler)
        if len(labeled) >= max(BUDGETS):
            break
        # Los más inciertos del pool sin etiquetar
        if model is not None:
            p = model.predict_proba(scaler.transform(X))[:, 1]
        else:
            p = c["match_probability"].to_numpy()
        unc = np.abs(p - 0.5)
        unc[labeled] = np.inf
        nxt = min(10, max(BUDGETS) - len(labeled))
        for B in BUDGETS:
            if len(labeled) < B < len(labeled) + nxt:
                nxt = B - len(labeled)
        order = np.lexsort((rng.random(len(unc)), unc))
        labeled += [int(i) for i in order[:nxt]]
    return out, y_all


def best_threshold(probs, y):
    best, best_f = 0.5, -1
    for t in np.unique(np.concatenate([probs, [0.5]])):
        pred = probs >= t
        tp = (pred & y).sum()
        p = tp / pred.sum() if pred.sum() else 0
        r = tp / y.sum() if y.sum() else 0
        f = 2 * p * r / (p + r) if p + r else 0
        if f > best_f:
            best, best_f = t, f
    return float(best)


# ── Ejecución ────────────────────────────────────────────────────────────────

def main():
    DATA.mkdir(exist_ok=True)
    log = []
    try:
        commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=OUT, capture_output=True, text=True).stdout.strip()
    except Exception:
        commit = "desconocido"

    for scenario in SCENARIOS:
        for seed in SEEDS:
            A, B = generate(scenario, seed)
            # La persona real solo se usa para la verdad de referencia; los métodos no la ven
            truth = truth_pairs(A, B)
            for name, df in (("A", A), ("B", B)):
                df.to_csv(DATA / f"{scenario}-s{seed}-{name}.csv.gz", index=False, compression="gzip")
            a, b = prepare(A.drop(columns="person_id")), prepare(B.drop(columns="person_id"))

            row = dict(escenario=scenario, semilla=seed, fichas_a=len(a), fichas_b=len(b), parejas_verdaderas=len(truth))
            row["M0"] = prf(m0(a, b), truth)

            c = splink_candidates(a, b, seed)
            cand = set(zip(c["unique_id_l"], c["unique_id_r"]))
            row["pares_candidatos"] = len(c)
            row["exhaustividad_maxima_bloqueo"] = round(len(cand & truth) / len(truth), 4)
            row["M1"] = prf({p for p, pr in zip(zip(c["unique_id_l"], c["unique_id_r"]), c["match_probability"]) if pr >= 0.5}, truth)

            ap_freq = a["ap1"].value_counts().to_dict()
            X = features(c, ap_freq)
            runs, y_all = active_learning(c, X, truth, seed)
            keys = list(zip(c["unique_id_l"], c["unique_id_r"]))
            for L, (lab, model, scaler) in runs.items():
                exclude = frozenset(keys[i] for i in lab)
                t = best_threshold(c["match_probability"].to_numpy()[lab], y_all[lab])
                row[f"M2_L{L}"] = dict(prf({k for k, pr in zip(keys, c["match_probability"]) if pr >= t}, truth, exclude), umbral=round(t, 4))
                p = model.predict_proba(scaler.transform(X))[:, 1]
                row[f"M3_L{L}"] = dict(prf({k for k, pr in zip(keys, p) if pr >= 0.5}, truth, exclude),
                                       positivos_etiquetados=int(y_all[lab].sum()))

                if scenario == "estandar" and seed == 1 and L == max(BUDGETS):
                    coefs = dict(zip(X.columns, (model.coef_[0] / scaler.scale_).round(6)))
                    model_hash = hashlib.sha256(json.dumps(coefs, sort_keys=True).encode()).hexdigest()
                    sel = np.flatnonzero((p >= 0.05))
                    Xs = scaler.transform(X.iloc[sel])
                    rows = []
                    for j, i in enumerate(sel):
                        contrib = dict(zip(X.columns, (Xs[j] * model.coef_[0]).round(4)))
                        top = dict(sorted(contrib.items(), key=lambda kv: -abs(kv[1]))[:6])
                        rows.append(dict(ficha_a=keys[i][0], ficha_b=keys[i][1], probabilidad=round(float(p[i]), 4),
                                         veredicto="misma_persona" if p[i] >= 0.5 else "distinta",
                                         contribuciones_principales=top,
                                         fecha=datetime.now(timezone.utc).isoformat()))
                    with gzip.open(OUT / "recibos-estandar-s1.jsonl.gz", "wt", encoding="utf-8") as f:
                        for r in receipt_chain(rows, model_hash):
                            f.write(json.dumps(r, ensure_ascii=False) + "\n")
                    (OUT / "modelo-estandar-s1-L199.json").write_text(json.dumps(
                        dict(sha256=model_hash, intercepto=float(model.intercept_[0]), coeficientes=coefs), indent=2, ensure_ascii=False))
            log.append(row)
            print(json.dumps({k: (v["f1"] if isinstance(v, dict) and "f1" in v else v) for k, v in row.items()}, ensure_ascii=False), flush=True)

    with open(OUT / "registros.jsonl", "w") as f:
        for r in log:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    methods = ["M0", "M1"] + [f"M2_L{L}" for L in BUDGETS] + [f"M3_L{L}" for L in BUDGETS]
    summary = {}
    for scenario in SCENARIOS:
        rows = [r for r in log if r["escenario"] == scenario]
        summary[scenario] = dict(
            exhaustividad_maxima_bloqueo=dict(media=round(float(np.mean([r["exhaustividad_maxima_bloqueo"] for r in rows])), 4),
                                              minimo=min(r["exhaustividad_maxima_bloqueo"] for r in rows)),
            metodos={m: {k: dict(media=round(float(np.mean([r[m][k] for r in rows])), 4),
                                 sd=round(float(np.std([r[m][k] for r in rows], ddof=1)), 4),
                                 minimo=min(r[m][k] for r in rows))
                         for k in ("precision", "exhaustividad", "f1")} for m in methods})
    std = [r for r in log if r["escenario"] == "estandar"]
    hyp = {f"M3_L{L}": dict(f1_por_conjunto=[r[f"M3_L{L}"]["f1"] for r in std],
                            cumple=all(r[f"M3_L{L}"]["f1"] >= 0.95 for r in std)) for L in BUDGETS}
    results = dict(prueba="T05 · E4 · Resolución de identidades", fecha_ejecucion=datetime.now(timezone.utc).isoformat(),
                   commit=commit, semillas=SEEDS, presupuestos=BUDGETS, hipotesis_H1_H5_1=hyp, resumen=summary)
    (OUT / "resultados.json").write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(dict(hipotesis=hyp, resumen={s: {m: v["f1"] for m, v in summary[s]["metodos"].items()} for s in summary}), indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
