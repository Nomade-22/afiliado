#!/usr/bin/env python3
"""Teste pontual do link curto enviado pelo usuário. Somente leitura, sem cookies salvos."""
import json
import re
from urllib.parse import urlsplit
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

LINK = "https://s.shopee.com.br/6q2UWhCh7x"

def meta(soup, name):
    for key in ("property", "name"):
        found = soup.find("meta", attrs={key: name})
        if found and found.get("content"):
            return str(found.get("content")).strip()
    return ""

def product_jsonld(soup):
    for el in soup.find_all("script", type="application/ld+json"):
        try:
            payload=json.loads(el.string or el.get_text() or "null")
        except Exception:
            continue
        stack=[payload]
        while stack:
            obj=stack.pop()
            if isinstance(obj,list):
                stack.extend(obj[:25])
            elif isinstance(obj,dict):
                typ=obj.get("@type",[])
                types=[typ] if isinstance(typ,str) else typ
                if any(str(t).lower()=="product" for t in types):
                    return obj
                if "@graph" in obj:stack.append(obj["@graph"])
    return {}

def safe_media(url):
    if not isinstance(url,str):return None
    if url.startswith("//"):url="https:"+url
    try:
        p=urlsplit(url)
        host=(p.hostname or "").lower()
        if p.scheme!="https" or not any(host==d or host.endswith("."+d) for d in ("shopee.com.br","shopee.com","susercontent.com","shopee.sg")):
            return None
        return url.split("?")[0]
    except Exception:return None

def inspect(page, label):
    print("ETAPA",label,flush=True)
    print("URL_FINAL",page.url.split("?")[0][:350],flush=True)
    soup=BeautifulSoup(page.content(),"html.parser")
    title=page.title()
    og_title=meta(soup,"og:title")
    og_desc=meta(soup,"og:description")
    product=product_jsonld(soup)
    ptitle=str(product.get("name") or "")
    desc=str(product.get("description") or og_desc or "")
    is_product=bool(product) or (
        bool(og_title) and not ("Shopee Brasil" in og_title or "Ofertas incríveis" in og_title)
        and bool(re.search(r"-i\.\d+\.\d+|/product/\d+/\d+",page.url))
    )
    raw=[]
    imgs=product.get("image",[])
    if isinstance(imgs,str):raw.append(imgs)
    elif isinstance(imgs,list):raw.extend(imgs)
    if is_product:
        raw.append(meta(soup,"og:image"))
        for im in soup.select('[data-sqe="product-image"] img, [class*="product-image"] img, [class*="product-gallery"] img'):
            for key in ("src","data-src","data-original"):raw.append(im.get(key))
    photos=list(dict.fromkeys(u for u in (safe_media(v) for v in raw) if u))[:12]
    print("TITULO_PAGINA",repr(title[:180]),flush=True)
    print("OG_TITLE",repr(og_title[:180]),flush=True)
    print("PRODUCT_JSON_LD",bool(product),flush=True)
    print("NOME_PRODUTO",repr(ptitle[:220]),flush=True)
    print("ANUNCIO_CONFIRMADO",is_product,flush=True)
    print("DESCRICAO_CARACTERES",len(desc) if is_product else 0,flush=True)
    print("DESCRICAO_PREVIA",repr(desc[:350]) if is_product else "NENHUMA",flush=True)
    print("FOTOS_VALIDAS",len(photos),flush=True)
    for i,u in enumerate(photos[:5],1):
        print("FOTO",i,u[:350],flush=True)
    return is_product

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(locale="pt-BR",viewport={"width":1280,"height":850},
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
    page=context.new_page()
    try:
        response=page.goto(LINK,wait_until="domcontentloaded",timeout=35000)
        print("HTTP_INICIAL",response.status if response else "SEM RESPOSTA",flush=True)
        page.wait_for_timeout(7000)
        inspect(page,"LINK_CURTO")
    except Exception as exc:
        print("ERRO_NAVEGACAO",type(exc).__name__,str(exc)[:400],flush=True)
        try:inspect(page,"PAGINA_APOS_ERRO")
        except Exception as exc2:print("ERRO_INSPECAO",str(exc2)[:150],flush=True)
    finally:
        context.close()
        browser.close()
