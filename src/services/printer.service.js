// Printer Service for KasQ
// Supports Web/System Printing and Bluetooth ESC/POS printing (Web Bluetooth API)

const DEFAULT_SETTINGS = {
  connectionType: 'system', // 'system' or 'bluetooth'
  paperSize: '58mm', // '58mm' or '80mm'
  headerText: '',
  footerText: 'Terima Kasih!\nSelamat Berbelanja Kembali',
  autoPrint: false,
  titleFontSize: 'large', // 'small' | 'medium' | 'large'
  bodyFontSize: 'normal',  // 'small' | 'normal' | 'large'
  fontFamily: 'courier',    // 'courier' | 'monospace' | 'sans-serif' | 'serif'
  dividerChar: '-',         // '-' | '*' | '=' | '.'
  showLogo: true,           // true | false
  showCashierName: true,    // true | false
  uppercaseTitle: true,     // true | false
  bottomFeedLines: 1,       // 0 to 5, default 1 to save paper
  autoCut: false,           // Auto cut receipt (only recommended for 80mm cutters)
  showLogoImage: false,     // true | false
  logoImageBase64: '',      // base64 image data
  headerAlign: 'center',    // 'left' | 'center' | 'right'
};

let activeDevice = null;
let activeCharacteristic = null;

// Standalone helper to convert base64 image to 1-bit ESC/POS raster bit image bytes
function convertImageToEscPosBytes(base64Image, targetWidth = 192) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.src = base64Image;
    img.onload = () => {
      try {
        const scale = targetWidth / img.width;
        const targetHeight = Math.round(img.height * scale);
        
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const pixels = imgData.data;
        
        const widthInBytes = targetWidth / 8;
        const data = new Uint8Array(widthInBytes * targetHeight);
        
        for (let y = 0; y < targetHeight; y++) {
          for (let x = 0; x < widthInBytes; x++) {
            let byteVal = 0;
            for (let bit = 0; bit < 8; bit++) {
              const pixelX = x * 8 + bit;
              const index = (y * targetWidth + pixelX) * 4;
              let isBlack = false;
              
              if (pixelX < targetWidth) {
                const r = pixels[index];
                const g = pixels[index + 1];
                const b = pixels[index + 2];
                const a = pixels[index + 3];
                
                if (a < 50) {
                  isBlack = false;
                } else {
                  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                  isBlack = luminance < 128;
                }
              }
              if (isBlack) {
                byteVal |= (1 << (7 - bit));
              }
            }
            data[y * widthInBytes + x] = byteVal;
          }
        }
        
        const header = new Uint8Array([
          0x1D, 0x76, 0x30, 0x00,
          widthInBytes & 0xFF,
          (widthInBytes >> 8) & 0xFF,
          targetHeight & 0xFF,
          (targetHeight >> 8) & 0xFF
        ]);
        
        const result = new Uint8Array(header.length + data.length);
        result.set(header);
        result.set(data, header.length);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => reject(new Error('Gagal memuat gambar logo'));
  });
}

export const printerService = {
  // Load settings
  getSettings() {
    try {
      const stored = localStorage.getItem('kasq_printer_settings');
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  },

  // Save settings
  saveSettings(settings) {
    localStorage.setItem('kasq_printer_settings', JSON.stringify(settings));
  },

  // Check if Web Bluetooth is supported
  isBluetoothSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  },

  // Check if currently connected to a BT printer
  isBluetoothConnected() {
    return activeDevice && activeDevice.gatt.connected && activeCharacteristic !== null;
  },

  // Get connected device name
  getConnectedDeviceName() {
    return activeDevice ? activeDevice.name || 'Printer Bluetooth' : null;
  },

  // Connect Bluetooth printer
  async connectBluetooth() {
    if (!this.isBluetoothSupported()) {
      throw new Error('Web Bluetooth tidak didukung oleh browser/perangkat ini.');
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer UUID
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Chip UUID
          'e7e1a190-273f-11e2-81c1-0800200c9a66', // Custom Printer UUID
          '00001101-0000-1000-8000-00805f9b34fb'  // SPP UUID
        ]
      });

      const server = await device.gatt.connect();
      
      // Look for a writeable characteristic in all services
      let charFound = null;
      const services = await server.getPrimaryServices();
      
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              charFound = char;
              break;
            }
          }
        } catch (e) {
          console.warn('Gagal membaca karakteristik dari service:', service.uuid, e);
        }
        if (charFound) break;
      }

      if (!charFound) {
        await server.disconnect();
        throw new Error('Karakteristik penulisan (write) printer tidak ditemukan.');
      }

      activeDevice = device;
      activeCharacteristic = charFound;

      // Handle disconnect
      device.addEventListener('gattserverdisconnected', () => {
        activeDevice = null;
        activeCharacteristic = null;
        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('printer-disconnected'));
      });

      return device.name || 'Printer Bluetooth';
    } catch (error) {
      console.error('Bluetooth connection failed:', error);
      throw error;
    }
  },

  // Disconnect Bluetooth
  async disconnectBluetooth() {
    if (activeDevice && activeDevice.gatt.connected) {
      activeDevice.gatt.disconnect();
    }
    activeDevice = null;
    activeCharacteristic = null;
  },

  // Format ESC/POS Receipt
  formatEscPos(transaction, businessName, userName, settings, logoBytes = null) {
    const maxChars = settings.paperSize === '80mm' ? 48 : 32;
    const encoder = new TextEncoder();
    
    // ESC/POS Commands
    const init = new Uint8Array([0x1B, 0x40]); // Initialize
    const center = new Uint8Array([0x1B, 0x61, 0x01]); // Align center
    const left = new Uint8Array([0x1B, 0x61, 0x00]); // Align left
    const right = new Uint8Array([0x1B, 0x61, 0x02]); // Align right
    const boldOn = new Uint8Array([0x1B, 0x45, 0x01]); // Bold on
    const boldOff = new Uint8Array([0x1B, 0x45, 0x00]); // Bold off
    const feedLines = typeof settings.bottomFeedLines !== 'undefined' ? Number(settings.bottomFeedLines) : 1;
    const shouldCut = settings.autoCut ?? (settings.paperSize === '80mm');
    const feedAndCut = shouldCut
      ? new Uint8Array([0x1B, 0x64, feedLines, 0x1D, 0x56, 0x42, 0x00]) // Feed settings.bottomFeedLines lines and partial cut
      : new Uint8Array([0x1B, 0x64, feedLines]); // Feed settings.bottomFeedLines lines, no cut
    const doubleSize = new Uint8Array([0x1B, 0x21, 0x30]); // Large font
    const normalSize = new Uint8Array([0x1B, 0x21, 0x00]); // Normal font

    const wrapTextToLines = (text, width) => {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      for (const word of words) {
        if (!word) continue;
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (testLine.length <= width) {
          currentLine = testLine;
        } else {
          if (word.length > width) {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = '';
            }
            let remaining = word;
            while (remaining.length > width) {
              lines.push(remaining.substring(0, width));
              remaining = remaining.substring(width);
            }
            currentLine = remaining;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      return lines;
    };

    let chunks = [];

    const addText = (text) => {
      chunks.push(encoder.encode(text + '\n'));
    };

    const addCmd = (cmd) => {
      chunks.push(cmd);
    };

    const formatRow = (leftStr, rightStr) => {
      const spaces = maxChars - (leftStr.length + rightStr.length);
      if (spaces <= 0) {
        return leftStr.slice(0, maxChars - rightStr.length - 1) + ' ' + rightStr;
      }
      return leftStr + ' '.repeat(spaces) + rightStr;
    };

    const dividerChar = settings.dividerChar || '-';
    const dividerLine = dividerChar.repeat(maxChars);

    // Header
    addCmd(init);
    
    // Header Alignment Option
    const headerAlign = settings.headerAlign || 'center';
    const headerAlignCmd = headerAlign === 'left' ? left : headerAlign === 'right' ? right : center;
    addCmd(headerAlignCmd);

    if (logoBytes) {
      addCmd(logoBytes);
      addCmd(new Uint8Array([0x0A])); // Line feed
    }
    
    const isDoubleSize = settings.titleFontSize !== 'small';
    if (isDoubleSize) {
      addCmd(doubleSize);
    }
    addCmd(boldOn);
    
    const displayTitle = settings.uppercaseTitle !== false ? businessName.toUpperCase() : businessName;
    const titleMaxChars = isDoubleSize ? Math.floor(maxChars / 2) : maxChars;
    const titleLines = wrapTextToLines(displayTitle, titleMaxChars);
    
    titleLines.forEach(line => {
      addText(line);
    });
    
    addCmd(normalSize);
    addCmd(boldOff);

    if (settings.headerText) {
      addText(settings.headerText);
    }
    
    addCmd(headerAlignCmd);
    if (settings.showCashierName !== false) {
      addText(`Kasir: ${userName}`);
    }
    addText(new Date(transaction.date).toLocaleString('id-ID'));
    if (transaction.customerName) {
      addText(`Pemesan: ${transaction.customerName}`);
    }
    
    addCmd(left);
    addText(dividerLine);

    // Items
    transaction.items.forEach(item => {
      // Line 1: Item Name
      addText(item.name);
      // Line 2: Qty x Price and Total
      const qtyPrice = `  ${item.qty} x Rp ${item.price.toLocaleString('id-ID')}`;
      const totalItem = `Rp ${(item.price * item.qty).toLocaleString('id-ID')}`;
      addText(formatRow(qtyPrice, totalItem));
    });

    addText(dividerLine);

    // Totals
    addCmd(boldOn);
    addText(formatRow('TOTAL', `Rp ${transaction.total.toLocaleString('id-ID')}`));
    addCmd(boldOff);

    const paymentMethodName = {
      'CASH': 'Tunai',
      'QRIS': 'QRIS / E-Wallet',
      'BANK_TRANSFER': 'Transfer Bank'
    }[transaction.paymentMethod] || 'Tunai';

    addText(formatRow('Metode', paymentMethodName));

    if (transaction.cashReceived) {
      addText(formatRow('Bayar', `Rp ${transaction.cashReceived.toLocaleString('id-ID')}`));
      addText(formatRow('Kembali', `Rp ${transaction.cashChange.toLocaleString('id-ID')}`));
    }

    addText(dividerLine);

    // Footer
    if (settings.footerText) {
      addCmd(center);
      addText(settings.footerText);
    }

    if (settings.showLogo !== false) {
      addCmd(center);
      addText('Powered by KasQ');
    }
    
    // Feed and Cut
    addCmd(feedAndCut);

    // Merge chunks into a single Uint8Array
    let totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    let result = new Uint8Array(totalLength);
    let offset = 0;
    for (let chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return result;
  },

  // Write bytes in chunks to avoid GATT MTU overload
  async writeCharacteristicInChunks(characteristic, data) {
    const canWriteWithoutResponse = characteristic.properties.writeWithoutResponse;
    const hasWriteWithoutResponseMethod = typeof characteristic.writeValueWithoutResponse === 'function';
    const useWithoutResponse = canWriteWithoutResponse && hasWriteWithoutResponseMethod;

    // Use larger chunk size and shorter delay for writeWithoutResponse
    const maxChunkSize = useWithoutResponse ? 120 : 20;
    const delayMs = useWithoutResponse ? 5 : 15;

    for (let i = 0; i < data.length; i += maxChunkSize) {
      const chunk = data.slice(i, i + maxChunkSize);
      if (useWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  },

  // Print using System/Browser Print
  printSystem(transaction, businessName, userName, settings) {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) {
      throw new Error('Popup diblokir! Harap izinkan popup browser.');
    }

    const itemsHtml = transaction.items.map(item => `
      <tr>
        <td style="padding: 2px 0;">${item.name} x${item.qty}</td>
        <td style="text-align: right; padding: 2px 0;">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</td>
      </tr>
    `).join('');

    const dateStr = new Date(transaction.date).toLocaleString('id-ID');
    const paymentMethodName = {
      'CASH': 'Tunai',
      'QRIS': 'QRIS / E-Wallet',
      'BANK_TRANSFER': 'Transfer Bank'
    }[transaction.paymentMethod] || 'Tunai';

    const width = settings.paperSize === '80mm' ? '80mm' : '58mm';
    const maxChars = settings.paperSize === '80mm' ? 48 : 32;

    const fontMap = {
      'courier': "'Courier New', Courier, monospace",
      'monospace': "monospace",
      'sans-serif': "system-ui, -apple-system, sans-serif",
      'serif': "Georgia, serif"
    };
    const selectedFont = fontMap[settings.fontFamily] || fontMap['courier'];

    const titleSizeMap = {
      'small': '11px',
      'medium': '13px',
      'large': '16px'
    };
    const bodySizeMap = {
      'small': '9px',
      'normal': '11px',
      'large': '13px'
    };
    const titleSize = titleSizeMap[settings.titleFontSize] || '16px';
    const bodySize = bodySizeMap[settings.bodyFontSize] || '11px';

    const headerHtml = settings.headerText 
      ? `<div style="font-size: ${bodySize === '13px' ? '11px' : '9px'}; white-space: pre-line; margin-bottom: 4px;">${settings.headerText}</div>`
      : '';
    const footerHtml = settings.footerText
      ? `<div style="font-size: ${bodySize === '13px' ? '11px' : '9px'}; white-space: pre-line; margin-top: 4px;">${settings.footerText}</div>`
      : '';

    const dividerChar = settings.dividerChar || '-';
    const dividerText = dividerChar.repeat(maxChars);

    const displayTitle = settings.uppercaseTitle !== false ? businessName.toUpperCase() : businessName;

    const cashierHtml = settings.showCashierName !== false 
      ? `<div style="font-size: ${bodySize === '13px' ? '11px' : '9px'}; margin-top: 2px;">Kasir: ${userName}</div>`
      : '';

    const logoHtml = settings.showLogo !== false
      ? `<div style="font-size: ${bodySize === '13px' ? '9px' : '8px'}; margin-top: 4px; color: #555;">Powered by KasQ</div>`
      : '';

    const logoImageHtml = (settings.showLogoImage && settings.logoImageBase64)
      ? `<div style="margin-bottom: 8px;"><img src="${settings.logoImageBase64}" style="max-width: 60px; max-height: 60px; object-fit: contain;" /></div>`
      : '';

    const headerAlign = settings.headerAlign || 'center';
    const alignClass = `text-${headerAlign}`;

    const html = `
      <html>
        <head>
          <title>Struk KasQ</title>
          <style>
            @page { size: ${width} auto; margin: 0; }
            body {
              font-family: ${selectedFont};
              font-size: ${bodySize};
              color: #000;
              margin: 0;
              padding: 4px;
              width: ${width};
              box-sizing: border-box;
            }
            .text-left { text-align: left; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { 
              font-family: 'Courier New', monospace; 
              font-size: ${bodySize}; 
              letter-spacing: 0.5px; 
              margin: 4px 0; 
              white-space: nowrap; 
              overflow: hidden; 
            }
            table { width: 100%; border-collapse: collapse; font-family: ${selectedFont}; font-size: ${bodySize}; }
          </style>
        </head>
        <body>
          <div class="${alignClass}">
            ${logoImageHtml}
            <div class="bold" style="font-size: ${titleSize};">${displayTitle}</div>
            ${headerHtml}
            ${cashierHtml}
            <div style="font-size: ${bodySize === '13px' ? '11px' : '9px'};">${dateStr}</div>
            ${transaction.customerName ? `<div style="font-size: ${bodySize === '13px' ? '11px' : '9px'}; font-weight: bold; margin-top: 2px;">Pemesan: ${transaction.customerName}</div>` : ''}
          </div>
          <div class="divider">${dividerText}</div>
          <table>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="divider">${dividerText}</div>
          <table>
            <tr>
              <td class="bold">TOTAL</td>
              <td class="bold" style="text-align: right;">Rp ${transaction.total.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td>Metode</td>
              <td style="text-align: right;">${paymentMethodName}</td>
            </tr>
            ${transaction.cashReceived ? `
            <tr>
              <td>Bayar</td>
              <td style="text-align: right;">Rp ${transaction.cashReceived.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td>Kembali</td>
              <td style="text-align: right;">Rp ${transaction.cashChange.toLocaleString('id-ID')}</td>
            </tr>
            ` : ''}
          </table>
          <div class="divider">${dividerText}</div>
          <div class="text-center">
            ${footerHtml}
            ${logoHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  },

  // Print Test Page
  async printTestPage(businessName, userName) {
    const settings = this.getSettings();
    const mockTxn = {
      date: new Date().toISOString(),
      customerName: 'Pelanggan Uji Coba',
      items: [
        { name: 'Kopi Susu Gula Aren', qty: 1, price: 18000 },
        { name: 'Roti Bakar Cokelat', qty: 2, price: 12000 }
      ],
      total: 42000,
      paymentMethod: 'CASH',
      cashReceived: 50000,
      cashChange: 8000
    };

    let logoBytes = null;
    if (settings.showLogoImage && settings.logoImageBase64) {
      try {
        const targetWidth = settings.paperSize === '80mm' ? 384 : 192;
        logoBytes = await convertImageToEscPosBytes(settings.logoImageBase64, targetWidth);
      } catch (e) {
        console.error('Failed to convert logo to ESC/POS:', e);
      }
    }

    if (settings.connectionType === 'bluetooth') {
      if (!this.isBluetoothConnected()) {
        throw new Error('Printer bluetooth belum terhubung. Silakan pasangkan terlebih dahulu.');
      }
      const bytes = this.formatEscPos(mockTxn, businessName, userName, settings, logoBytes);
      await this.writeCharacteristicInChunks(activeCharacteristic, bytes);
    } else {
      this.printSystem(mockTxn, businessName, userName, settings);
    }
  },

  // Main print route
  async printReceipt(transaction, businessName, userName) {
    const settings = this.getSettings();
    let logoBytes = null;
    if (settings.showLogoImage && settings.logoImageBase64) {
      try {
        const targetWidth = settings.paperSize === '80mm' ? 384 : 192;
        logoBytes = await convertImageToEscPosBytes(settings.logoImageBase64, targetWidth);
      } catch (e) {
        console.error('Failed to convert logo to ESC/POS:', e);
      }
    }
    
    if (settings.connectionType === 'bluetooth') {
      if (!this.isBluetoothConnected()) {
        console.warn('Printer bluetooth terputus. Fallback ke sistem print.');
        // Fallback to system print if BT is selected but not connected
        this.printSystem(transaction, businessName, userName, settings);
        return;
      }
      try {
        const bytes = this.formatEscPos(transaction, businessName, userName, settings, logoBytes);
        await this.writeCharacteristicInChunks(activeCharacteristic, bytes);
      } catch (err) {
        console.error('Bluetooth printing failed:', err);
        // Fallback to system print
        this.printSystem(transaction, businessName, userName, settings);
      }
    } else {
      this.printSystem(transaction, businessName, userName, settings);
    }
  }
};
