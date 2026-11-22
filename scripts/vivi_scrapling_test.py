#!/usr/bin/env python3
"""Teste isolado, somente leitura, de 10 anúncios públicos da Shopee.

Sem login, cookies de usuários, endpoints privados, proxies ou resolução de CAPTCHA.
Os resultados vão para tabela separada no Neon via endpoint autenticado por OIDC.
NUNCA escreve em vivi_offers.
"""
import html
import io
import json
import os
import re
import sys
import time
import unicodedata
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

API = "https://ofertas-da-vivi.vercel.app/api/automation/scrapling-test"
ALLOWED_IMAGE_HOSTS = (
    "shopee.sg", "shopee.com", "shopee.com.br", "susercontent.com"
)
COMMON_WORDS = {"para", "com", "sem", "que", "uma", "por", "kit", "the",
    "shopee", "brasil", "original", "novo", "feminina", "feminino", "produto",
    "promo", "preco", "oferta"}


def token():
    endpoint = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    request_token = os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
    joiner = "&" if "?" in endpoint else "?"
    from urllib.parse import quote
    url = endpoint + joiner + "audience=" + quote(API, safe="")
    req = Request(url, headers={"Authorization": "Bearer " + request_token})
    with urlopen(req, timeout=20) as response:
        jwt = json.load(response)["value"]
    if not jwt:
        raise ValueError("OIDC não retornou token")
    return jwt


def api_call(method, payload=None):
    body = json.dumps(payload).encode("utf8") if payload is not None else None
    headers = {"Authorization": "Bearer " + token(), "Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = Request(API, data=body, headers=headers, method=method)
    with urlopen(req, timeout=35) as response:
        return json.load(response)


def norm(text):
    text = unicodedata.normalize("NFKD", str(text or ""))
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in text
             if not unicodedata.combining(c)).lower()).strip()


def matches_title(expected, actual):
    a = [w for w in norm(expected).split() if len(w) >= 4 and w not in COMMON_WORDS]
    b = set(norm(actual).split())
    if not a or not b:
        return False
    return sum(w in b for w in a[:9]) >= min(2, len(a))


def image_url(raw):
    try:
        url = str(raw or "").strip()
        if url.startswith("//"):
            url = "https:" + url
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
        if (parts.scheme != "https" or parts.username or parts.password or
            not any(host == x or host.endswith("." + x) for x in ALLOWED_IMAGE_HOSTS)):
            return None
        if not parts.path or len(url) > 1100:
            return None
        return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
    except Exception:
        return None


def image_identity(url):
    parts = urlsplit(url)
    # Os CDN da Shopee criam URLs de tamanhos diferentes da mesma foto.
    path = re.sub(r"(_tn|@resize_w[0-9]+_n[lq])$", "", parts.path.lower())
    path = re.sub(r"(_[0-9]{2,4}x[0-9]{2,4})$", "", path)
    return path.split("/")[-1] or path


def extract_product_jsonld(soup):
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(script.string or script.get_text() or "")
        except Exception:
            continue
        queue = [data]
        for _ in range(100):
            if not queue:
                break
            node = queue.pop(0)
            if isinstance(node, list):
                queue.extend(node[:20])
            elif isinstance(node, dict):
                type_name = node.get("@type", "")
                if isinstance(type_name, list):
                    types = [str(x).lower() for x in type_name]
                else:
                    types = [str(type_name).lower()]
                if "product" in types:
                    return node
                if "@graph" in node:
                    queue.append(node["@graph"])
    return {}


def metatag(soup, field):
    for attribute in ("property", "name"):
        node = soup.find("meta", attrs={attribute: field})
        if node:
            return str(node.get("content") or "").strip()
    return ""


def normalize_description(raw):
    if not isinstance(raw, str):
        return ""
    soup = BeautifulSoup(html.unescape(raw), "html.parser")
    text = " ".join(soup.stripped_strings).strip()
    if re.search(r"verifica.{0,9}o de seguran|captcha|acesso negado", norm(text)):
        return ""
    if len(text) < 35:
        return ""
    return text[:3500]


def extract_html(content, expected_title):
    soup = BeautifulSoup(content, "html.parser")
    raw_page_title = metatag(soup, "og:title") or (
        soup.h1.get_text(" ", strip=True) if soup.h1 else "") or (
        soup.title.get_text(" ", strip=True) if soup.title else "")
    product = extract_product_jsonld(soup)
    title = str(product.get("name") or raw_page_title)
    if not matches_title(expected_title, title):
        return {"titleMatched": False, "description": "",
                "images": [], "reason": "Título do anúncio não confere ou página genérica."}
    description = ""
    origin = ""
    sources = [
        ("json_ld", product.get("description")),
        ("meta_og", metatag(soup, "og:description")),
    ]
    for sel in ('[data-sqe="product-description"]',
                '[class*="product-detail"] [class*="description"]',
                '[class*="product-description"]',
                '#product-description'):
        for node in soup.select(sel)[:2]:
            sources.append(("pagina_renderizada", node.get_text(" ", strip=True)))
    for label, raw in sources:
        value = normalize_description(raw)
        if len(value) >= 45 and not norm(value).startswith(
            ("compre online", "descubra ofertas", "compre na shopee")):
            description, origin = value, label
            break
    image_candidates = []
    images = product.get("image")
    if isinstance(images, str):
        image_candidates.append(images)
    elif isinstance(images, list):
        image_candidates.extend(images[:25])
    image_candidates.append(metatag(soup, "og:image"))
    selectors = ('[data-sqe="product-image"] img, [class*="product-image"] img, '
                 '[class*="product-gallery"] img, [class*="image-carousel"] img, '
                 '[class*="product"] [class*="thumbnail"] img')
    for el in soup.select(selectors)[:80]:
        for attribute in ("src", "data-src", "data-original", "currentSrc"):
            image_candidates.append(el.get(attribute))
        srcset = el.get("srcset", "")
        if srcset:
            image_candidates.append(srcset.split(",")[-1].strip().split(" ")[0])
    originals = [image_url(x) for x in image_candidates if isinstance(x, str)]
    originals = [x for x in originals if x]
    found = set()
    distinct = []
    for url in originals:
        key = image_identity(url)
        if key in found:
            continue
        found.add(key)
        distinct.append(url)
        if len(distinct) == 12:
            break
    return {"titleMatched": True, "description": description,
            "descriptionSource": origin, "images": distinct,
            "duplicateImagesRemoved": max(0, len(originals) - len(distinct)),
            "reason": ""}


def analyze_one(product):
    from scrapling.fetchers import DynamicFetcher
    t = time.monotonic()
    result = {
        "id": product["id"], "title": product["title"],
        "sourceUrl": product["sourceUrl"], "httpStatus": 0, "status": "error",
        "description": "", "descriptionSource": "", "images": [],
        "duplicateImagesRemoved": 0, "titleMatched": False, "reason": ""
    }
    try:
        # Navegador normal: sem sessão autenticada, sem rotação de IP e sem burlar desafios.
        response = DynamicFetcher.fetch(
            product["sourceUrl"], headless=True, google_search=False,
            network_idle=False, timeout=22000, wait=950, retries=0
        )
        result["httpStatus"] = int(response.status or 0)
        content = response.body.decode("utf8", "replace")
        low = norm(content[:15000])
        if result["httpStatus"] in (403, 429) or (
            "captcha" in low and len(content) < 50000) or (
            "verificacao de seguranca" in low and len(content) < 50000):
            result.update(status="blocked", reason="Shopee exigiu verificação ou restringiu o acesso público.")
        elif result["httpStatus"] >= 400:
            result.update(status="unavailable", reason="HTTP " + str(result["httpStatus"]))
        elif not content.strip():
            result.update(status="unavailable", reason="Resposta vazia.")
        else:
            parsed = extract_html(content, product["title"])
            result.update(parsed)
            if not parsed["titleMatched"]:
                result.update(status="unavailable")
            elif parsed["description"] and len(parsed["images"]) >= 2:
                result.update(status="success")
            elif parsed["description"] or parsed["images"]:
                result.update(status="partial",
                    reason="Somente parte dos detalhes está acessível.")
            else:
                result.update(status="unavailable",
                    reason="Nenhuma descrição ou galeria foi encontrada na página pública.")
    except Exception as exc:
        result.update(status="error",reason=type(exc).__name__ + ": " + str(exc)[:150])
    result["runtimeSeconds"] = round(time.monotonic() - t, 1)
    return result


def main():
    started = time.monotonic()
    data = api_call("GET")
    run = data["runId"]
    products = data["products"][:10]
    print("Produtos para testar:", len(products))
    results = []
    blocked = 0
    try:
        for index, product in enumerate(products):
            if blocked >= 3:
                results.append({
                    "id": product["id"], "title": product["title"],
                    "sourceUrl": product["sourceUrl"], "status": "not_attempted",
                    "reason": "Interrompido após três páginas bloqueadas.",
                    "httpStatus": 0, "description": "", "images": [], "titleMatched": False
                })
                continue
            item = analyze_one(product)
            if item["status"] == "blocked":
                blocked += 1
            print(f"{index + 1}/{len(products)}: {item['status']} · "
                  f"{len(item['images'])} imagem(ns) · "
                  f"{len(item['description'])} caracteres")
            results.append(item)
            time.sleep(2.1)
    except Exception as exc:
        print("Erro geral:", type(exc).__name__)
    payload = {
        "runId": run, "results": results,
        "status": "completed" if len(results) == len(products) else "failed",
        "notes": f"Scrapling DynamicFetcher, {len(results)}/{len(products)} anúncios, "
                 f"{round(time.monotonic()-started)}s, sem alterações na vitrine."
    }
    response = api_call("POST",payload)
    print("Relatório registrado:", response.get("stored"), "anúncios.")
    # Saída zero mesmo se bloqueado; relatório descreve o resultado.
    return 0


if __name__ == "__main__":
    sys.exit(main())
