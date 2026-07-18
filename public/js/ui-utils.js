// js/ui-utils.js - Sistema de Feedback, Logs y Modales de Confirmación Customizados

export const logger = (msg, type = 'info') => {
    const emoji = { info: '💡', success: '✅', error: '❌', search: '🔍', action: '⚡' };
    const styles = {
        info: 'color: #94a3b8',
        success: 'color: #22c55e; font-weight: bold',
        error: 'color: #ef4444; font-weight: bold',
        search: 'color: #38bdf8',
        action: 'color: #fbbf24'
    };
    console.log(`%c${emoji[type] || '🔔'} ${msg}`, styles[type] || styles.info);
    
    // Si es éxito o error importante, mostramos un Toast (burbuja flotante)
    if (type === 'success' || type === 'error' || type === 'action') {
        showToast(msg, type);
    }
};

export function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }, 100);
}

export function customConfirm(title, message, buttonText = "Confirmar") {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-msg');
        const btnYes = document.getElementById('confirm-yes') || document.getElementById('btn-confirm-yes');
        const btnNo = document.getElementById('confirm-no') || document.getElementById('btn-confirm-no');
        
        titleEl.textContent = title;
        msgEl.textContent = message;
        btnYes.textContent = buttonText;
        
        modal.classList.remove('hidden');
        
        const cleanup = (result) => {
            modal.classList.add('hidden');
            btnYes.onclick = null;
            btnNo.onclick = null;
            resolve(result);
        };
        
        btnYes.onclick = () => cleanup(true);
        btnNo.onclick = () => cleanup(false);
    });
}

export function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
