import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfills for Node.js environment
if (!global.TextEncoder) {
    global.TextEncoder = TextEncoder as any;
}
if (!global.TextDecoder) {
    global.TextDecoder = TextDecoder as any;
}

// Mock IndexedDB for Node.js environment
if (typeof window === 'undefined') {
    require('fake-indexeddb/auto');
}

// Mock crypto for Node.js
if (typeof global.crypto === 'undefined') {
    global.crypto = {
        getRandomValues: (arr: any) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        },
        randomUUID: () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    } as any;
}

// Mock performance API if not available
if (typeof global.performance === 'undefined') {
    global.performance = {
        now: () => Date.now()
    } as any;
}

// Increase timeout for integration tests
jest.setTimeout(30000);