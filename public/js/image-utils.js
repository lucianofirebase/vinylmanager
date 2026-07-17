// js/image-utils.js - Procesamiento y Compresión de Imágenes en Cliente

export function compressImage(file, maxWidth) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Bajamos calidad a 0.5 para que pesen muy poco
                resolve(canvas.toDataURL('image/jpeg', 0.5));
            };
            img.onerror = () => {
                reject(new Error("Error al decodificar la imagen. El archivo podría estar corrupto."));
            };
            img.src = event.target.result;
        };
        
        reader.onerror = (error) => reject(error || new Error("Error al leer el archivo."));
        reader.onabort = () => reject(new Error("Lectura del archivo abortada."));
        
        reader.readAsDataURL(file);
    });
}
