export const categories=['Todos','Casa','Beleza','Moda','Eletrônicos','Utilidades','Infantil','Saúde','Pets','Esportes','Automotivo','Outros'];

function norm(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
// Ordem importa: "bolsa térmica" é Casa, "canguru bebê" é Infantil,
// "tratamento capilar" é Beleza, não Saúde.
// Só classifica títulos com evidências textuais suficientes.
export function inferCategory(title,fallback='Outros'){
 const s=norm(title);
 if(!s)return fallback;
 if(/\b(cachorro|cachorros|gato|gatos|pet|pets|felino|canino|rac[a-z]* para pet)\b/.test(s))return 'Pets';
 if(/\b(bebe|bebes|infantil|crianca|criancas|mamadeira|fralda|canguru|berco|carrinho de bebe)\b/.test(s))return 'Infantil';
 if(/\b(automotiv[ao]|carro|veiculo|pintura automotiva|parabrisa|tira riscos)\b/.test(s))return 'Automotivo';
 if(/\b(suplemento|suplementos|capsula|capsulas|biotina|psyllium|melatonina|nac|cisteina|picolinato|metilfolato|vitamina|vitaminas|zinco|magnesio|body action|alwaysfit|fits36|provit|pro3)\b/.test(s))return 'Saúde';
 if(/\b(shampoo|condicionador|mascara capilar|mascara tratamento|tratamento capilar|oleo capilar|finalizador|antifrizz|frizz|sobrancelha|wella|koleston|elseve|l oreal|maquiagem|cosmetico|cosmeticos|perfume|hidratante|batom|ruby rose|beleza)\b/.test(s))return 'Beleza';
 if(/\b(academia|trampolim|jump|fitness|exercicio|esporte|esportes|musculacao|yoga|pilates|bicicleta ergometrica)\b/.test(s))return 'Esportes';
 if(/\b(fone|bluetooth|eletronic[ao]|smartwatch|notebook|computador|headset|mouse gamer|teclado|celular|tablet|carregador|usb|caixa de som|camera wifi)\b/.test(s))return 'Eletrônicos';
 if(/\b(bolsa termica|garrafa termica|garrafa de agua|lixeira|liquidificador|pote|ta[cç]a|copo|cozinha|vidro hermetico|panela|frigideira|organizad|jogo de ta[cç]as|utensilio|decoracao|almofada|casa)\b/.test(s))return 'Casa';
 if(/\b(sandalia|rasteirinha|chinelo|sapato|salome|sapatilha|salto|tamanco|bolsa feminina|bolsa baguete|bolsa de ombro|bolsa transversal|bolsa chic|mini bag|blusa|cropped|vestido|macaquinho|regata|calca|camisa|shorts|saia|lingerie|sutia|moda|mochila)\b/.test(s))return 'Moda';
 if(/\b(escova removedora|removedor de pelos|limpeza|pratico|multifuncional)\b/.test(s))return 'Utilidades';
 return categories.includes(fallback)?fallback:'Outros';
}
