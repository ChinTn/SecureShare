export const toast = {
    success: (message) => {
        window.dispatchEvent(new CustomEvent('toast', { detail: { message, type: 'success' } }));
    },
    error: (message) => {
        window.dispatchEvent(new CustomEvent('toast', { detail: { message, type: 'error' } }));
    },
    info: (message) => {
        window.dispatchEvent(new CustomEvent('toast', { detail: { message, type: 'info' } }));
    }
};
