// js/whatsapp.js - Formateo y Generación de Mensajes para WhatsApp Marketing

export function getFormatIcon(format) {
    if (format === 'CD') return '💿';
    if (format === 'Cassette') return '📼';
    return '💿';
}

export function getGradeText(grade, isCover = false) {
    const prefix = isCover ? "Tapa " : "Disco ";
    const mapping = {
        'MINT': isCover ? 'Sellado' : 'Nuevo / Sellado',
        'NM': isCover ? 'Excelente (Como nuevo)' : 'igual a nuevo!!',
        'VG+': isCover ? 'Excelente' : 'Excelente',
        'VG': isCover ? 'Muy buena' : 'Muy bueno',
        'G+': isCover ? 'Buena+' : 'Bueno+',
        'G': isCover ? 'Buena' : 'Bueno',
        'F': 'Regular',
        'P': 'Pobre'
    };
    return prefix + (mapping[grade] || grade);
}

export function generateWhatsAppText(items) {
    let text = "🔥 *NUEVA TANDA - DISPONIBLES* 🔥\n\n";
    
    items.forEach(item => {
        const title = (item.title || 'Título Desconocido').toString().toUpperCase();
        const artist = (item.artist || 'Artista Desconocido').toString();
        const price = item.price || 0;
        const format = item.format || 'Vinyl';
        const formatIcon = getFormatIcon(format);
        
        text += `${formatIcon} *${title}*\n`;
        text += `👤 ${artist}\n`;
        if (item.label) text += `🏷️ ${item.label}\n`;
        
        const gMedia = getGradeText(item.grade || 'VG+');
        const gCover = getGradeText(item.gradeCover || item.grade || 'VG+', true);
        text += `📀 Disco: ${gMedia} | 📁 Tapa: ${gCover}\n`;
        
        const photoInfo = (item.photos && item.photos.length > 0) || (item.discogsPhotos && item.discogsPhotos.length > 0) ? " 📸 *(Pide fotos)*" : "";
        text += `💰 *$${price}*${photoInfo}\n\n`;
        text += `--------------------------\n\n`;
    });

    text += "✨ ¡Escríbeme para reservar el tuyo!\n";
    text += "🚚 Envíos a todo el país.";
    
    return text;
}
