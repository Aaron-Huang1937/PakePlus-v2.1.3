// 在构造函数中添加一个属性来存储当前应用的模板名
class DataFilterPage {
    constructor() {
        this.originalData = null;
        this.originalHeaders = [];
        this.selectedHeaders = [];
        this.filteredData = [];
        this.currentWorkbook = null;  // 存储当前Excel工作簿
        this.currentFileName = '';    // 存储当前文件名
        this.currentRawData = null;   // 存储原始数据（未处理）
        this.headerRowIndex = 0;      // 表头所在行索引（默认第一行）
        this.currentTemplateName = ''; // 存储当前应用的模板名
        
        this.init();
    }

    // 判断是否为Excel日期序列号
    // Excel日期序列号通常在1900年1月1日（序列号1）到2030年左右（序列号约47000）之间
    // 但我们使用更严格的范围和额外的验证来避免将普通数值误识别为日期
    isExcelDateSerial(value) {
        // 检查是否为数字且在合理的日期序列号范围内
        if (typeof value !== 'number') return false;
        
        // Excel日期序列号通常在1-100000之间
        // 1对应1900年1月1日，47000对应2030年左右
        if (value < 1 || value > 100000) return false;
        
        // 更严格的检查：只识别可能的日期范围（大约1950-2050年）
        // 1950-01-01对应的序列号约为18264
        // 2050-12-31对应的序列号约为54789
        if (value < 18264 || value > 54789) return false;
        
        // 进一步检查：尝试转换为日期并验证
        try {
            const convertedDate = DateHelper.convertExcelDate(value);
            // 检查转换后的日期是否合理（在1950年到2050年之间）
            const dateParts = convertedDate.split('-');
            if (dateParts.length === 3) {
                const year = parseInt(dateParts[0]);
                if (year >= 1950 && year <= 2050) {
                    return true;
                }
            }
        } catch (e) {
            // 转换失败，不是有效的日期序列号
            return false;
        }
        
        return false;
    }

    // 根据表头名称判断是否应优先处理为日期
    shouldProcessAsDate(headerName) {
        const dateKeywords = ['年月', '日期', '时间'];
        return dateKeywords.some(keyword => headerName.includes(keyword));
    }

    // 根据表头名称判断是否应优先处理为数字
    shouldProcessAsNumber(headerName) {
        const numberKeywords = ['单价', '总价', '金额', '数量', '价', '额'];
        return numberKeywords.some(keyword => headerName.includes(keyword));
    }

    // 智能处理单元格值
    processCellValue(cellValue, headerName) {
        // 使用修复后的处理逻辑
        return DataFilterFix.processCellValue(cellValue, headerName);
    }

    // 数据筛选页面逻辑
    init() {
        this.bindEvents();
        this.setupDragAndDrop();
    }

    // 绑定事件
    bindEvents() {
        // 文件选择
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        // 清空数据
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearAllData();
        });

        // 清空选择
        document.getElementById('clearSelectedBtn').addEventListener('click', () => {
            this.clearSelectedHeaders();
        });

        // 生成预览
        document.getElementById('generatePreviewBtn').addEventListener('click', () => {
            this.generatePreview();
        });

        // 导出Excel
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportToExcel();
        });
        
        // 解析选中的工作表
        document.getElementById('parseWorksheetBtn').addEventListener('click', () => {
            this.parseSelectedWorksheet();
        });
        
        // 取消工作表选择
        document.getElementById('cancelWorksheetBtn').addEventListener('click', () => {
            this.cancelWorksheetSelection();
        });
        
        // 表头行选择变化
        document.getElementById('headerRowSelect').addEventListener('change', (e) => {
            this.headerRowIndex = parseInt(e.target.value);
            this.reprocessCurrentData();
        });
        
        // 按组导出按钮
        const exportByGroupBtn = document.getElementById('exportByGroupBtn');
        if (exportByGroupBtn) {
            exportByGroupBtn.addEventListener('click', () => {
                this.exportByGroup();
            });
        }
        
        // 全选按钮
        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllHeaders();
            });
        }
        
        // 模板导出按钮
        const exportTemplateBtn = document.getElementById('exportTemplateBtn');
        if (exportTemplateBtn) {
            exportTemplateBtn.addEventListener('click', () => {
                this.exportTemplate();
            });
        }
        
        // 模板导入按钮 (现在在文件导入区域)
        const importTemplateBtn = document.getElementById('importTemplateBtn');
        const importTemplateInput = document.getElementById('importTemplateInput');
        if (importTemplateBtn && importTemplateInput) {
            importTemplateBtn.addEventListener('click', () => {
                importTemplateInput.click();
            });
            
            importTemplateInput.addEventListener('change', (e) => {
                this.importTemplate(e);
            });
        }
        
        // 按模板导出按钮
        const exportByTemplateBtn = document.getElementById('exportByTemplateBtn');
        if (exportByTemplateBtn) {
            exportByTemplateBtn.addEventListener('click', () => {
                this.exportByTemplate();
            });
        }
        
        // 数据筛选按钮事件
        this.bindFilterEvents();
    }

    // 设置拖拽功能
    setupDragAndDrop() {
        const originalContainer = document.getElementById('originalHeaders');
        const selectedContainer = document.getElementById('selectedHeaders');

        // 为容器添加拖拽事件
        this.setupDropZone(originalContainer);
        this.setupDropZone(selectedContainer);
    }

    // 设置拖拽区域
    setupDropZone(container) {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('drag-over');
        });

        container.addEventListener('dragleave', (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            
            const headerText = e.dataTransfer.getData('text/plain');
            const sourceContainer = e.dataTransfer.getData('source');
            
            this.handleDrop(headerText, container.id, sourceContainer);
        });
    }

    // 检测文件编码
    detectEncoding(buffer) {
        console.log('开始检测文件编码，buffer长度:', buffer.length);
        
        const encodings = [
            { name: 'UTF-8', bom: [0xEF, 0xBB, 0xBF] },
            { name: 'UTF-16BE', bom: [0xFE, 0xFF] },
            { name: 'UTF-16LE', bom: [0xFF, 0xFE] }
        ];
        
        // 检查BOM
        for (const encoding of encodings) {
            if (buffer.length >= encoding.bom.length) {
                let match = true;
                for (let i = 0; i < encoding.bom.length; i++) {
                    if (buffer[i] !== encoding.bom[i]) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    console.log('检测到BOM编码:', encoding.name);
                    return encoding.name;
                }
            }
        }
        
        // 如果没有BOM，尝试通过统计方法检测
        // 检查是否为UTF-8
        let isUtf8 = true;
        let nonAsciiCount = 0;
        for (let i = 0; i < Math.min(buffer.length, 1000); i++) {
            if (buffer[i] > 127) {
                nonAsciiCount++;
                if (nonAsciiCount > 10) { // 如果有超过10个非ASCII字符，认为不是UTF-8
                    isUtf8 = false;
                    break;
                }
            }
        }
        
        console.log('非ASCII字符数量:', nonAsciiCount, '是否可能是UTF-8:', isUtf8);
        
        if (isUtf8) {
            console.log('检测到编码: UTF-8');
            return 'UTF-8';
        }
        
        // 默认返回GBK作为常见的中文编码
        console.log('默认返回编码: GBK');
        return 'GBK';
    }

    // 处理文件选择
    handleFileSelect(event) {
        console.log('handleFileSelect 被调用');
        const files = event.target.files;
        console.log('选择的文件:', files);
        
        if (!files || files.length === 0) {
            console.log('没有选择文件');
            return;
        }

        // 限制最多导入10个文件
        if (files.length > 10) {
            alert('最多只能同时导入10个文件');
            // 清空文件选择
            document.getElementById('fileInput').value = '';
            return;
        }

        // 更新文件名显示
        if (files.length === 1) {
            document.getElementById('fileName').textContent = files[0].name;
        } else {
            document.getElementById('fileName').textContent = `已选择 ${files.length} 个文件`;
        }
        document.getElementById('clearBtn').style.display = 'inline-block';

        // 显示处理中提示
        console.log(`开始处理 ${files.length} 个文件...`);

        // 处理所有选中的文件
        console.log('调用 processMultipleFiles');
        this.processMultipleFiles(files);
    }

    // 处理多个文件
    processMultipleFiles(files) {
        console.log('processMultipleFiles 被调用，文件数量:', files.length);
        
        // 在处理新文件之前，清除之前的数据、筛选和选择状态
        console.log('清除之前的数据、筛选和选择状态');
        this.originalData = null;
        this.originalHeaders = [];
        this.selectedHeaders = [];
        this.filteredData = [];
        this.currentWorkbook = null;
        this.currentFileName = '';
        this.currentRawData = null;
        this.headerRowIndex = 0;
        this.importedFileNames = [];
        this.templateFiles = [];
        
        // 清除筛选条件
        console.log('调用 clearDataFilter');
        this.clearDataFilter();
        
        // 清空选择
        console.log('调用 clearSelectedHeaders');
        this.clearSelectedHeaders();
        
        // 隐藏预览区域
        this.hidePreview();
        
        // 隐藏数据筛选区域
        const dataFilterSection = document.getElementById('dataFilterSection');
        if (dataFilterSection) {
            dataFilterSection.style.display = 'none';
        }
        
        // 隐藏按模板导出按钮
        const exportByTemplateBtn = document.getElementById('exportByTemplateBtn');
        if (exportByTemplateBtn) {
            exportByTemplateBtn.style.display = 'none';
        }
        
        // 清空分组导出列选项
        const select = document.getElementById('groupExportColumn');
        if (select) {
            while (select.options.length > 1) {
                select.remove(1);
            }
        }

        // 用于存储所有文件的数据
        const allData = [];
        const allHeaders = [];
        const fileNames = [];
        
        // 处理每个文件
        let processedCount = 0;
        const totalFiles = files.length;
        
        // 显示处理进度
        console.log(`开始处理 ${totalFiles} 个文件`);
        
        // 创建处理函数
        const processNextFile = (index) => {
            console.log(`processNextFile 被调用，索引: ${index}`);
            
            if (index >= totalFiles) {
                // 所有文件处理完成，合并数据
                console.log(`所有文件处理完成，开始合并数据`);
                this.mergeAndDisplayData(allData, allHeaders, fileNames);
                // 确保显示相关区域
                this.showSections();
                // 显示表头行选择器区域
                const headerRowSelector = document.getElementById('headerRowSelector');
                if (headerRowSelector) {
                    headerRowSelector.style.display = 'block';
                    console.log('显示表头行选择器区域');
                }
                return;
            }
            
            const file = files[index];
            
            console.log(`正在处理文件 ${index + 1}/${totalFiles}: ${file.name}`);
            
            if (file.name.toLowerCase().endsWith('.csv')) {
                // 对于CSV文件，先以二进制方式读取以检测编码
                const bufferReader = new FileReader();
                bufferReader.onload = (e) => {
                    const buffer = new Uint8Array(e.target.result);
                    const encoding = this.detectEncoding(buffer);
                    
                    console.log('检测到CSV文件编码:', encoding);
                    
                    // 根据检测到的编码读取文件
                    if (encoding === 'UTF-8') {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            try {
                                const csvData = this.parseCSVData(e.target.result, file.name);
                                allData.push(csvData.data);
                                allHeaders.push(csvData.headers);
                                processedCount++;
                                fileNames.push(file.name);
                                console.log(`文件 ${file.name} 处理完成 (${processedCount}/${totalFiles})`);
                                // 确保显示相关区域
                                this.showSections();
                                // 显示表头行选择器
                                this.showHeaderRowSelector();
                                processNextFile(index + 1);
                            } catch (error) {
                                console.error('文件解析失败:', error);
                                alert('文件解析失败: ' + error.message);
                                processedCount++;
                                processNextFile(index + 1);
                            }
                        };
                        reader.readAsText(file, 'UTF-8');
                    } else if (encoding === 'GBK') {
                        // 对于GBK编码，使用TextDecoder进行转换
                        try {
                            const decoder = new TextDecoder('gbk');
                            const decodedText = decoder.decode(buffer);
                            console.log('GBK解码成功，解码后文本长度:', decodedText.length);
                            // 将转换后的文本传递给处理函数
                            const csvData = this.parseCSVData(decodedText, file.name);
                            allData.push(csvData.data);
                            allHeaders.push(csvData.headers);
                            processedCount++;
                            fileNames.push(file.name);
                            console.log(`文件 ${file.name} 处理完成 (${processedCount}/${totalFiles})`);
                            // 确保显示相关区域
                            this.showSections();
                            // 显示表头行选择器
                            this.showHeaderRowSelector();
                            processNextFile(index + 1);
                        } catch (decodeError) {
                            console.error('GBK解码失败:', decodeError);
                            // 如果TextDecoder不支持GBK，尝试使用默认方式读取
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                try {
                                    console.log('使用默认方式读取文件');
                                    const csvData = this.parseCSVData(e.target.result, file.name);
                                    allData.push(csvData.data);
                                    allHeaders.push(csvData.headers);
                                    processedCount++;
                                    fileNames.push(file.name);
                                    console.log(`文件 ${file.name} 处理完成 (${processedCount}/${totalFiles})`);
                                    // 确保显示相关区域
                                    this.showSections();
                                    // 显示表头行选择器
                                    this.showHeaderRowSelector();
                                    processNextFile(index + 1);
                                } catch (error) {
                                    console.error('文件解析失败:', error);
                                    alert('文件解析失败: ' + error.message);
                                    processedCount++;
                                    processNextFile(index + 1);
                                }
                            };
                            reader.readAsText(file);
                        }
                    } else {
                        // 对于其他编码，尝试使用默认方式读取
                        console.log('使用默认方式读取其他编码文件:', encoding);
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            try {
                                const csvData = this.parseCSVData(e.target.result, file.name);
                                allData.push(csvData.data);
                                allHeaders.push(csvData.headers);
                                processedCount++;
                                fileNames.push(file.name);
                                console.log(`文件 ${file.name} 处理完成 (${processedCount}/${totalFiles})`);
                                // 确保显示相关区域
                                this.showSections();
                                // 显示表头行选择器
                                this.showHeaderRowSelector();
                                processNextFile(index + 1);
                            } catch (error) {
                                console.error('文件解析失败:', error);
                                alert('文件解析失败: ' + error.message);
                                processedCount++;
                                processNextFile(index + 1);
                            }
                        };
                        reader.readAsText(file);
                    }
                };
                
                bufferReader.readAsArrayBuffer(file);
            } else {
                // 对于Excel文件，直接读取
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        // 检查是否是多工作表Excel文件
                        const arrayBuffer = e.target.result;
                        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellFormula: true, bookDeps: true });
                        const fileName = file.name;
                        
                        if (workbook.SheetNames.length > 1) {
                            // 多个工作表，保存工作簿并显示选择器
                            this.currentWorkbook = workbook;
                            this.currentFileName = fileName;
                            
                            // 保存当前处理状态，以便在用户选择工作表后继续处理
                            this.pendingFileProcessing = {
                                allData: allData,
                                allHeaders: allHeaders,
                                fileNames: fileNames,
                                processedCount: processedCount,
                                totalFiles: totalFiles,
                                currentIndex: index,
                                processNextFile: processNextFile
                            };
                            
                            this.showWorksheetSelector();
                        } else {
                            // 只有一个工作表，直接解析
                            const workbook = XLSX.read(arrayBuffer, { type: 'array', cellFormula: true, bookDeps: true });
                            const firstSheetName = workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[firstSheetName];
                            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
                            
                            // 保存原始数据格式用于表头选择
                            this.currentRawData = rawData;
                            this.headerRowIndex = 0;
                            this.currentFileName = fileName;
                            
                            const excelData = this.parseExcelData(arrayBuffer, fileName);
                            allData.push(excelData.data);
                            allHeaders.push(excelData.headers);
                            processedCount++;
                            fileNames.push(file.name);
                            console.log(`文件 ${fileName} 处理完成 (${processedCount}/${totalFiles})`);
                            // 确保显示相关区域
                            this.showSections();
                            // 显示表头行选择器
                            this.showHeaderRowSelector();
                            processNextFile(index + 1);
                        }
                    } catch (error) {
                        console.error('文件解析失败:', error);
                        alert('文件解析失败: ' + error.message);
                        processedCount++;
                        fileNames.push(file.name);
                        processNextFile(index + 1);
                    }
                };
                reader.readAsArrayBuffer(file);
            }
        };
        
        // 开始处理第一个文件
        console.log('开始处理第一个文件');
        processNextFile(0);
    }

    // 解析CSV数据
    parseCSVData(data, fileName) {
        let csvText = data;
        
        // 检查并移除BOM标记
        if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.slice(1);
        }
        
        // 清理可能存在的不可见字符
        csvText = csvText.replace(/\u200B-\u200D\u2060/g, '');
        
        // 清理CSV文本中的不可见字符
        const cleanCsvText = csvText.replace(/\u200B-\u200D\u2060/g, '');
        const lines = cleanCsvText.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
            throw new Error('CSV文件为空');
        }

        // 解析所有行作为原始数据
        const rawData = lines.map(line => this.parseCSVLine(line));
        
        // 保存原始数据格式用于表头选择
        this.currentRawData = rawData;
        this.headerRowIndex = 0;
        this.currentFileName = fileName;
        
        // 使用第一行作为表头
        const headers = rawData[0].map(header => String(header || '').trim()).filter(h => h);
        
        // 处理数据行
        const dataRows = [];
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (row && row.some(cell => cell !== undefined && cell !== '')) {
                const rowData = {};
                headers.forEach((header, index) => {
                    rowData[header] = String(row[index] !== undefined && row[index] !== null ? row[index] : '').trim();
                });
                dataRows.push(rowData);
            }
        }
        
        return {
            headers: headers,
            data: dataRows,
            fileName: fileName
        };
    }

    // 解析Excel数据
    parseExcelData(arrayBuffer, fileName) {
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellFormula: true, bookDeps: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
        
        if (jsonData.length === 0) {
            throw new Error('Excel文件为空');
        }
        
        // 修复包含跨工作表引用的Excel文件数据列偏移问题
        jsonData = DataFilterFix.fixExcelDataWithExternalReferences(jsonData);
        
        // 保存原始数据格式用于表头选择
        this.currentRawData = jsonData;
        this.headerRowIndex = 0;
        this.currentFileName = fileName;
        
        // 使用第一行作为表头
        const headers = jsonData[0].map(header => String(header || '').trim()).filter(h => h);
        
        // 处理数据行
        const dataRows = [];
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.some(cell => cell !== undefined && cell !== '')) {
                const rowData = {};
                headers.forEach((header, index) => {
                    // 处理Excel日期格式
                    let cellValue = row[index];
                    if (cellValue instanceof Date) {
                        // 如果是Date对象，格式化为标准日期字符串
                        try {
                            const utcDate = new Date(Date.UTC(cellValue.getFullYear(), cellValue.getMonth(), cellValue.getDate()));
                            cellValue = DateHelper.formatDate(utcDate);
                        } catch (e) {
                            console.warn('Date对象格式化失败:', cellValue, e);
                        }
                    }
                    rowData[header] = String(cellValue || '').trim();
                });
                dataRows.push(rowData);
            }
        }
        
        return {
            headers: headers,
            data: dataRows,
            fileName: fileName
        };
    }

    // 合并并显示数据
    mergeAndDisplayData(allData, allHeaders, fileNames) {
        console.log('mergeAndDisplayData 被调用');
        console.log('allData:', allData);
        console.log('allHeaders:', allHeaders);
        console.log('fileNames:', fileNames);
        
        // 合并所有表头
        const mergedHeaders = [...new Set(allHeaders.flat())];
        console.log('mergedHeaders:', mergedHeaders);
        
        // 合并所有数据
        const mergedData = [];
        allData.forEach((data, index) => {
            // 只有在导入多个文件时才添加文件来源信息
            if (fileNames.length > 1) {
                // 为每行数据添加文件来源信息
                data.forEach(row => {
                    const newRow = { ...row };
                    newRow['数据来源'] = fileNames[index];
                    mergedData.push(newRow);
                });
            } else {
                // 单个文件直接添加数据
                mergedData.push(...data);
            }
        });
        
        // 只有在导入多个文件时才添加"数据来源"表头
        if (fileNames.length > 1 && !mergedHeaders.includes('数据来源')) {
            mergedHeaders.push('数据来源');
        }
        
        this.originalHeaders = mergedHeaders;
        this.originalData = mergedData;
        this.filteredData = mergedData;
        this.currentFileName = fileNames.length > 1 ? `合并数据(${fileNames.length}个文件)` : fileNames[0];
        // 保存所有文件名，用于导出时生成正确的文件名
        this.importedFileNames = fileNames;

        // 不再自动选择所有表头
        this.selectedHeaders = [];
        
        console.log('调用 displayOriginalHeaders');
        this.displayOriginalHeaders();
        console.log('调用 updateSelectedHeaders');
        this.updateSelectedHeaders(); // 更新选中表头显示
        console.log('调用 showSections');
        this.showSections();
        
        // 更新分组导出列选项
        console.log('调用 updateGroupExportOptions');
        this.updateGroupExportOptions();
        
        // 显示预览区域但不生成预览数据
        console.log('调用 showPreviewWithoutCheck');
        this.showPreviewWithoutCheck();
        
        // 显示成功消息
        if (fileNames.length > 1) {
            console.log(`成功导入并合并 ${fileNames.length} 个文件，共 ${mergedData.length} 行数据`);
        } else {
            console.log(`成功导入文件 ${fileNames[0]}，共 ${mergedData.length} 行数据`);
        }
        
        console.log('合并解析完成:', {
            headers: mergedHeaders.length,
            rows: mergedData.length,
            sample: mergedData.slice(0, 3)
        });
        
        // 确保显示相关区域
        this.showSections();
        
        // 显示数据筛选区域
        const filterSection = document.getElementById('dataFilterSection');
        if (filterSection) {
            filterSection.style.display = 'block';
            console.log('显示数据筛选区域');
        }
        
        // 显示表头行选择器区域
        const headerRowSelector = document.getElementById('headerRowSelector');
        if (headerRowSelector) {
            headerRowSelector.style.display = 'block';
            console.log('显示表头行选择器区域');
        }
        
        // 确保预览区域显示
        this.showPreviewWithoutCheck();
        
        // 确保按模板导出按钮显示
        const exportByTemplateBtn = document.getElementById('exportByTemplateBtn');
        if (exportByTemplateBtn) {
            exportByTemplateBtn.style.display = 'inline-block';
            console.log('显示按模板导出按钮');
        }
    }

    // 解析CSV行（处理逗号和引号）
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"' && (i === 0 || line[i-1] === ',')) {
                inQuotes = true;
            } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
                inQuotes = false;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    // 解析Excel文件（检查是否有多个工作表）
    parseExcelFile(arrayBuffer) {
        try {
            this.currentWorkbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            if (this.currentWorkbook.SheetNames.length > 1) {
                // 多个工作表，显示选择器
                this.showWorksheetSelector();
            } else {
                // 只有一个工作表，直接解析
                this.parseWorksheet(this.currentWorkbook.SheetNames[0]);
            }
        } catch (error) {
            throw new Error('解析Excel文件失败：' + error.message);
        }
    }

    // 处理解析后的数据
    processData(headers, data) {
        console.log('processData 被调用');
        console.log('headers:', headers);
        console.log('data length:', data.length);
        
        this.originalHeaders = headers;
        this.originalData = data;
        this.filteredData = data; // 初始化筛选数据为原始数据

        // 不自动选择所有表头
        this.selectedHeaders = [];

        console.log('调用 displayOriginalHeaders');
        this.displayOriginalHeaders();
        console.log('调用 updateSelectedHeaders');
        this.updateSelectedHeaders(); // 更新选中表头显示
        console.log('调用 showSections');
        this.showSections();
        
        // 更新分组导出列选项
        console.log('调用 updateGroupExportOptions');
        this.updateGroupExportOptions();
        
        // 不在初始化时生成预览，等待用户选择表头后再生成
        // console.log('调用 generatePreview');
        // this.generatePreview();
        
        // 显示数据筛选区域
        const filterSection = document.getElementById('dataFilterSection');
        if (filterSection) {
            filterSection.style.display = 'block';
            console.log('显示数据筛选区域');
        }
        
        console.log('解析完成:', {
            headers: headers.length,
            rows: data.length,
            sample: data.slice(0, 3)
        });
        
        // 显示表头行选择器区域
        const headerRowSelector = document.getElementById('headerRowSelector');
        if (headerRowSelector) {
            headerRowSelector.style.display = 'block';
            console.log('显示表头行选择器区域');
        }
        
        // 确保预览区域显示但不生成预览数据
        this.showPreviewWithoutCheck();
        
        // 确保按模板导出按钮显示
        const exportByTemplateBtn = document.getElementById('exportByTemplateBtn');
        if (exportByTemplateBtn) {
            exportByTemplateBtn.style.display = 'inline-block';
            console.log('显示按模板导出按钮');
        }
    }
    
    // 更新分组导出列选项
    updateGroupExportOptions() {
        const select = document.getElementById('groupExportColumn');
        if (!select) return;
        
        // 清空现有选项（保留第一个提示选项）
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // 添加表头作为选项
        this.originalHeaders.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            select.appendChild(option);
        });
        
        // 添加事件监听器，当选择分组列时显示不同值的数量
        select.addEventListener('change', (e) => {
            this.showGroupValueCount(e.target.value);
        });
    }

    // 显示分组列不同值的数量
    showGroupValueCount(selectedColumn) {
        const hintContainer = document.getElementById('groupExportHintContainer');
        const groupCountElement = document.getElementById('groupCount');
        
        if (!selectedColumn || !this.originalData || this.originalData.length === 0) {
            // 隐藏提示信息
            if (hintContainer) {
                hintContainer.style.display = 'none';
            }
            return;
        }
        
        // 计算选定列的不同值数量
        const uniqueValues = new Set();
        this.originalData.forEach(row => {
            const value = row[selectedColumn] || '未填写';
            uniqueValues.add(value);
        });
        
        // 更新提示信息
        if (hintContainer && groupCountElement) {
            groupCountElement.textContent = uniqueValues.size;
            hintContainer.style.display = 'block';
        }
    }

    // 显示原始表头
    displayOriginalHeaders() {
        const container = document.getElementById('originalHeaders');
        container.innerHTML = '';

        this.originalHeaders.forEach(header => {
            const chip = this.createHeaderChip(header, false);
            container.appendChild(chip);
        });
    }

    // 创建表头小方块
    createHeaderChip(headerText, isSelected = false) {
        const chip = document.createElement('div');
        chip.className = `header-chip draggable ${isSelected ? 'selected' : ''}`;
        chip.draggable = true;
        chip.textContent = headerText;
        
        // 存储原始表头名称在数据属性中
        chip.setAttribute('data-header', headerText);

        // 添加删除按钮（仅选中状态显示）
        if (isSelected) {
            const removeBtn = document.createElement('div');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeFromSelected(headerText);
            };
            chip.appendChild(removeBtn);
        }

        // 拖拽事件
        chip.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', headerText);
            e.dataTransfer.setData('source', isSelected ? 'selected' : 'original');
            chip.classList.add('dragging');
        });

        chip.addEventListener('dragend', () => {
            chip.classList.remove('dragging');
        });

        // 双击事件 - 自动添加到选中区域（仅对未选中的表头）
        if (!isSelected) {
            chip.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (!this.selectedHeaders.includes(headerText)) {
                    this.selectedHeaders.push(headerText);
                    this.updateSelectedHeaders();
                }
            });
        }

        return chip;
    }

    // 处理拖拽放置
    handleDrop(headerText, targetContainerId, sourceContainer) {
        if (targetContainerId === 'selectedHeaders') {
            // 拖拽到选择区域
            if (!this.selectedHeaders.includes(headerText)) {
                this.selectedHeaders.push(headerText);
                this.updateSelectedHeaders();
            }
        } else if (targetContainerId === 'originalHeaders' && sourceContainer === 'selected') {
            // 从选择区域拖回原始区域
            this.removeFromSelected(headerText);
        }
    }

    // 更新选中的表头显示
    updateSelectedHeaders() {
        const container = document.getElementById('selectedHeaders');
        const filterSection = document.getElementById('dataFilterSection');
        const filterCountSelect = document.getElementById('filterCountSelect');
        
        if (this.selectedHeaders.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center">将上方的表头拖动到这里进行筛选</p>';
            // 隐藏数据筛选区域
            if (filterSection) {
                filterSection.style.display = 'none';
            }
            return;
        }

        // 更新筛选条件数量选择器的选项
        if (filterCountSelect) {
            // 保存当前选中的值
            const currentValue = filterCountSelect.value;
            
            // 清空现有选项
            filterCountSelect.innerHTML = '';
            
            // 根据选中的表头数量添加选项，但至少显示2个选项
            const maxOptions = Math.max(2, Math.min(10, this.selectedHeaders.length));
            for (let i = 1; i <= maxOptions; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `${i}个`;
                if (i === 2) {
                    option.selected = true; // 默认选中2个
                }
                filterCountSelect.appendChild(option);
            }
            
            // 如果之前选中的值还在范围内，则保持选中
            if (currentValue && parseInt(currentValue) <= maxOptions) {
                filterCountSelect.value = currentValue;
            }
        }

        // 清空表头显示区域
        container.innerHTML = '';
        this.selectedHeaders.forEach(header => {
            const chip = this.createHeaderChip(header, true);
            container.appendChild(chip);
        });

        // 显示数据筛选区域
        if (filterSection) {
            filterSection.style.display = 'block';
            // 重新初始化筛选条件
            this.initFilterConditions();
        }

        // 设置选中区域的排序功能
        this.setupSortable(container);
    }
    
    // 更新数据筛选选项
    updateDataFilterOptions() {
        const filterSection = document.getElementById('dataFilterSection');
        
        if (!filterSection) return;
        
        if (this.selectedHeaders.length === 0) {
            filterSection.style.display = 'none';
            return;
        }
        
        // 显示筛选区域
        filterSection.style.display = 'block';
        
        // 初始化筛选条件
        this.initFilterConditions();
    }
    
    // 初始化筛选条件
    initFilterConditions() {
        const filterCountSelect = document.getElementById('filterCountSelect');
        const updateFilterCountBtn = document.getElementById('updateFilterCountBtn');
        const filterConditionsContainer = document.getElementById('filterConditionsContainer');
        
        if (!filterCountSelect || !updateFilterCountBtn || !filterConditionsContainer) return;
        
        // 绑定更新按钮事件
        updateFilterCountBtn.addEventListener('click', () => {
            this.updateFilterConditions();
        });
        
        // 初始化筛选条件
        this.updateFilterConditions();
    }
    
    // 更新筛选条件显示
    updateFilterConditions() {
        const filterCountSelect = document.getElementById('filterCountSelect');
        const filterConditionsContainer = document.getElementById('filterConditionsContainer');
        
        if (!filterCountSelect || !filterConditionsContainer) return;
        
        const filterCount = parseInt(filterCountSelect.value) || 2;
        let filterConditionsHTML = '';
        
        for (let i = 0; i < filterCount; i++) {
            // 生成选项HTML
            let optionsHTML = '';
            for (const header of this.selectedHeaders) {
                optionsHTML += `<option value="${header}">${header}</option>`;
            }
            
            filterConditionsHTML += `
                <div class="flex items-center gap-2 flex-wrap mb-2 filter-condition" data-index="${i}">
                    <span class="text-sm font-medium text-gray-700">条件${i+1}:</span>
                    <select id="filterColumnSelect${i}" class="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 filter-column-select">
                        <option value="">-- 选择筛选列 --</option>
                        ${optionsHTML}
                    </select>
                    <select id="filterOperatorSelect${i}" class="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 filter-operator-select">
                        <option value="contains">包含</option>
                    </select>
                    <!-- 筛选值下拉列表 -->
                    <select id="filterValueSelect${i}" class="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 filter-value-select">
                        <option value="">-- 选择筛选值 --</option>
                    </select>
                    <!-- 筛选值输入框 -->
                    <input type="text" id="filterValueInput${i}" placeholder="或输入筛选值" class="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 filter-value-input">
                    <!-- 排序选项（仅对数值和日期类型显示） -->
                    <select id="filterSortSelect${i}" class="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 filter-sort-select" style="display: none;">
                        <option value="">-- 排序 --</option>
                        <option value="all">全部</option>
                        <option value="asc">降序</option>
                        <option value="desc">升序</option>
                        <option value="top">前</option>
                        <option value="bottom">后</option>
                    </select>
                    <!-- 排序数量输入框 -->
                    <input type="number" id="filterSortCountInput${i}" placeholder="数量(默认全部)" class="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 filter-sort-count-input" style="display: none;" min="1">
                    <!-- 日期范围开始输入框 -->
                    <div class="relative" style="display: none;" id="filterDateRangeStartContainer${i}">
                        <input type="date" id="filterDateRangeStart${i}" class="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <!-- 日期范围结束输入框 -->
                    <div class="relative" style="display: none;" id="filterDateRangeEndContainer${i}">
                        <input type="date" id="filterDateRangeEnd${i}" class="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <!-- 数字范围最小值输入框 -->
                    <input type="text" id="filterNumberRangeMin${i}" placeholder="最小值" class="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style="display: none;">
                    <!-- 数字范围最大值输入框 -->
                    <input type="text" id="filterNumberRangeMax${i}" placeholder="最大值" class="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style="display: none;">
                </div>
            `;
        }
        
        filterConditionsHTML += `
            <div class="flex items-center gap-2 flex-wrap">
                <button id="applyFilterBtn" class="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded-md transition-colors">
                    应用筛选
                </button>
                <button id="clearFilterBtn" class="bg-gray-600 hover:bg-gray-700 text-white text-sm py-1 px-3 rounded-md transition-colors">
                    清除筛选
                </button>
            </div>
        `;
        
        filterConditionsContainer.innerHTML = filterConditionsHTML;
        
        // 绑定筛选按钮事件
        this.bindFilterEvents();
        
        // 为每个筛选条件绑定事件并初始化
        this.initializeFilterConditions(filterCount);
    }

    // 初始化筛选条件事件和选项
    initializeFilterConditions(filterCount) {
        // 使用 setTimeout 确保 DOM 元素已经创建完成
        setTimeout(() => {
            for (let i = 0; i < filterCount; i++) {
                const columnSelect = document.getElementById(`filterColumnSelect${i}`);
                const operatorSelect = document.getElementById(`filterOperatorSelect${i}`);
                
                if (columnSelect) {
                    // 绑定列选择事件
                    columnSelect.addEventListener('change', () => {
                        this.updateFilterOperatorOptions(i);
                        this.updateFilterValueOptions(i);
                    });
                    
                    // 如果已经有选中的列，更新操作符和值选项
                    if (columnSelect.value) {
                        this.updateFilterOperatorOptions(i);
                        this.updateFilterValueOptions(i);
                    }
                }
                
                if (operatorSelect) {
                    // 绑定操作符选择事件
                    operatorSelect.addEventListener('change', () => {
                        this.updateFilterInputVisibility(i);
                    });
                }
            }
        }, 0);
    }
    
    // 更新筛选操作符选项
    updateFilterOperatorOptions(index) {
        const filterColumnSelect = document.getElementById(`filterColumnSelect${index}`);
        const filterOperatorSelect = document.getElementById(`filterOperatorSelect${index}`);
        
        if (!filterColumnSelect || !filterOperatorSelect) return;
        
        const selectedColumn = filterColumnSelect.value;
        
        // 清空现有选项
        filterOperatorSelect.innerHTML = '';
        
        // 如果没有选择列，添加默认选项
        if (!selectedColumn) {
            const option = document.createElement('option');
            option.value = 'contains';
            option.textContent = '包含';
            filterOperatorSelect.appendChild(option);
            return;
        }
        
        // 获取列的数据类型
        const columnType = this.getColumnType(selectedColumn);
        
        // 根据列类型添加相应的操作符选项
        switch (columnType) {
            case 'number':
                this.addNumberOperatorOptions(filterOperatorSelect);
                break;
            case 'date':
                this.addDateOperatorOptions(filterOperatorSelect);
                break;
            default:
                this.addTextOperatorOptions(filterOperatorSelect);
                break;
        }
        
        // 更新输入控件可见性
        this.updateFilterInputVisibility(index);
    }
    
    // 更新筛选值选项
    updateFilterValueOptions(index) {
        const filterColumnSelect = document.getElementById(`filterColumnSelect${index}`);
        const filterValueSelect = document.getElementById(`filterValueSelect${index}`);
        const filterValueInput = document.getElementById(`filterValueInput${index}`);
        
        if (!filterColumnSelect || !filterValueSelect || !filterValueInput) return;
        
        const selectedColumn = filterColumnSelect.value;
        
        // 清空现有选项（保留第一个提示选项）
        while (filterValueSelect.options.length > 1) {
            filterValueSelect.remove(1);
        }
        
        // 如果没有选择列，直接返回
        if (!selectedColumn) {
            return;
        }
        
        // 获取该列的所有唯一值
        const uniqueValues = new Set();
        if (this.originalData) {
            this.originalData.forEach(row => {
                const value = row[selectedColumn];
                if (value !== undefined && value !== null) {
                    uniqueValues.add(String(value));
                }
            });
        }
        
        // 添加唯一值选项（最多显示100个，避免下拉列表过长）
        let count = 0;
        Array.from(uniqueValues).sort().forEach(value => {
            if (count < 100000) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                filterValueSelect.appendChild(option);
                count++;
            }
        });
        
        // 如果唯一值超过100个，添加提示选项
        if (uniqueValues.size > 100000) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = `... 还有${uniqueValues.size - 100000}个值`;
            option.disabled = true;
            filterValueSelect.appendChild(option);
        }
    }
    
    // 根据操作符类型更新输入控件可见性
    updateFilterInputVisibility(index) {
        const filterOperatorSelect = document.getElementById(`filterOperatorSelect${index}`);
        const filterValueSelect = document.getElementById(`filterValueSelect${index}`);
        const filterValueInput = document.getElementById(`filterValueInput${index}`);
        const filterDateRangeStart = document.getElementById(`filterDateRangeStart${index}`);
        const filterDateRangeEnd = document.getElementById(`filterDateRangeEnd${index}`);
        const filterDateRangeStartContainer = document.getElementById(`filterDateRangeStartContainer${index}`);
        const filterDateRangeEndContainer = document.getElementById(`filterDateRangeEndContainer${index}`);
        const filterNumberRangeMin = document.getElementById(`filterNumberRangeMin${index}`);
        const filterNumberRangeMax = document.getElementById(`filterNumberRangeMax${index}`);
        // 排序相关元素
        const filterSortSelect = document.getElementById(`filterSortSelect${index}`);
        const filterSortCountInput = document.getElementById(`filterSortCountInput${index}`);
        
        if (!filterOperatorSelect) return;
        
        const selectedOperator = filterOperatorSelect.value;
        const filterColumnSelect = document.getElementById(`filterColumnSelect${index}`);
        const columnType = filterColumnSelect ? this.getColumnType(filterColumnSelect.value) : 'text';
        
        // 隐藏所有输入控件
        if (filterValueSelect) filterValueSelect.style.display = 'none';
        if (filterValueInput) filterValueInput.style.display = 'none';
        if (filterDateRangeStartContainer) filterDateRangeStartContainer.style.display = 'none';
        if (filterDateRangeEndContainer) filterDateRangeEndContainer.style.display = 'none';
        if (filterNumberRangeMin) filterNumberRangeMin.style.display = 'none';
        if (filterNumberRangeMax) filterNumberRangeMax.style.display = 'none';
        // 隐藏排序选项
        if (filterSortSelect) filterSortSelect.style.display = 'none';
        if (filterSortCountInput) filterSortCountInput.style.display = 'none';
        
        // 根据操作符类型显示相应的输入控件
        switch (selectedOperator) {
            case 'between':
                if (filterColumnSelect) {
                    const columnType = this.getColumnType(filterColumnSelect.value);
                    if (columnType === 'date') {
                        if (filterDateRangeStartContainer) filterDateRangeStartContainer.style.display = 'inline-block';
                        if (filterDateRangeEndContainer) filterDateRangeEndContainer.style.display = 'inline-block';
                    } else if (columnType === 'number') {
                        if (filterNumberRangeMin) filterNumberRangeMin.style.display = 'inline-block';
                        if (filterNumberRangeMax) filterNumberRangeMax.style.display = 'inline-block';
                    } else {
                        // 文本类型的between操作符仍然使用普通输入框
                        if (filterValueInput) filterValueInput.style.display = 'inline-block';
                    }
                }
                break;
            case 'isEmpty':
            case 'isNotEmpty':
                // 这些操作符不需要输入值
                break;
            default:
                // 默认显示下拉列表和输入框
                if (filterValueSelect) filterValueSelect.style.display = 'inline-block';
                if (filterValueInput) filterValueInput.style.display = 'inline-block';
                // 如果是数值或日期类型，显示排序选项
                if ((columnType === 'number' || columnType === 'date') && filterSortSelect) {
                    filterSortSelect.style.display = 'inline-block';
                    filterSortCountInput.style.display = 'inline-block';
                }
                break;
        }
    }
    
    // 绑定筛选相关事件
    bindFilterEvents() {
        // 移除之前可能绑定的事件监听器
        const applyFilterBtn = document.getElementById('applyFilterBtn');
        const clearFilterBtn = document.getElementById('clearFilterBtn');
        
        if (applyFilterBtn) {
            applyFilterBtn.removeEventListener('click', this.handleApplyFilter);
            this.handleApplyFilter = () => this.applyDataFilter();
            applyFilterBtn.addEventListener('click', this.handleApplyFilter);
        }
        
        if (clearFilterBtn) {
            clearFilterBtn.removeEventListener('click', this.handleClearFilter);
            this.handleClearFilter = () => this.clearDataFilter();
            clearFilterBtn.addEventListener('click', this.handleClearFilter);
        }
    }
    
    // 获取列的数据类型
    getColumnType(columnName) {
        if (!this.originalData || this.originalData.length === 0) {
            return 'text'; // 默认为文本类型
        }
        
        // 前置定义：当列表头名包含有"年月、日期、时间"，优先按日期处理
        if (columnName.includes('年月') || columnName.includes('日期') || columnName.includes('时间')) {
            return 'date';
        }
        
        // 前置定义：当不包含"年月、日期、时间"时，优先按数字处理，尤其是表头含有"单价、总价、金额、数量、价、额"时优先按数字处理
        if (columnName.includes('单价') || columnName.includes('总价') || columnName.includes('金额') || 
            columnName.includes('数量') || columnName.includes('价') || columnName.includes('额')) {
            return 'number';
        }
        
        // 检查前10行数据来推断列类型
        const sampleSize = Math.min(10, this.originalData.length);
        let numberCount = 0;
        let dateCount = 0;
        let totalCount = 0;
        
        for (let i = 0; i < sampleSize; i++) {
            const row = this.originalData[i];
            const value = row[columnName];
            
            if (value === undefined || value === null || String(value).trim() === '') {
                continue; // 跳过空值
            }
            
            totalCount++;
            const strValue = String(value).trim();
            
            // 检查是否为数字
            if (/^-?\d+(\.\d+)?$/.test(strValue)) {
                numberCount++;
                continue;
            }
            
            // 检查是否为日期格式
            if (this.isLikelyDate(strValue)) {
                dateCount++;
                continue;
            }
        }
        
        // 如果超过60%的非空值为数字，则认为是数字列
        if (totalCount > 0 && numberCount / totalCount > 0.6) {
            return 'number';
        }
        
        // 如果超过60%的非空值为日期，则认为是日期列
        if (totalCount > 0 && dateCount / totalCount > 0.6) {
            return 'date';
        }
        
        // 默认为文本类型
        return 'text';
    }
    
    // 判断是否可能是日期格式
    isLikelyDate(value) {
        // 如果是纯数字且长度为5位，不认为是日期
        if (/^\d{5}$/.test(value)) {
            return false;
        }
        
        // 日期格式的正则表达式
        const datePatterns = [
            /^\d{4}-\d{1,2}-\d{1,2}$/,           // YYYY-MM-DD
            /^\d{4}\/\d{1,2}\/\d{1,2}$/,         // YYYY/MM/DD
            /^\d{1,2}-\d{1,2}-\d{4}$/,           // MM-DD-YYYY
            /^\d{1,2}\/\d{1,2}\/\d{4}$/,         // MM/DD/YYYY
            /^\d{4}年\d{1,2}月\d{1,2}日$/,        // YYYY年MM月DD日
            /^\d{1,2}月\d{1,2}日$/,              // MM月DD日
        ];
        
        return datePatterns.some(pattern => pattern.test(value));
    }
    
    // 解析日期字符串为Date对象
    parseDate(dateString) {
        if (!dateString) return null;
        
        // 尝试直接使用Date构造函数
        let date = new Date(dateString);
        
        // 如果直接解析失败，尝试其他常见格式
        if (isNaN(date.getTime())) {
            // 尝试解析常见的中文日期格式
            const chineseDatePattern = /(\d{4})年(\d{1,2})月(\d{1,2})日/;
            const match = dateString.match(chineseDatePattern);
            if (match) {
                date = new Date(match[1], parseInt(match[2]) - 1, match[3]);
            } else {
                // 尝试解析其他常见格式，如 2022/9/1 或 2022-9-1
                const commonPatterns = [
                    /(\d{4})-(\d{1,2})-(\d{1,2})/,
                    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
                    /(\d{4})\.(\d{1,2})\.(\d{1,2})/
                ];
                
                for (const pattern of commonPatterns) {
                    const match = dateString.match(pattern);
                    if (match) {
                        date = new Date(match[1], parseInt(match[2]) - 1, match[3]);
                        if (!isNaN(date.getTime())) {
                            break;
                        }
                    }
                }
            }
        }
        
        // 如果解析成功，返回UTC日期对象
        if (!isNaN(date.getTime())) {
            // 使用UTC日期避免时区问题
            return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        }
        
        return null;
    }
    
    // 添加文本操作符选项
    addTextOperatorOptions(selectElement) {
        const options = [
            { value: 'contains', text: '包含' },
            { value: 'equals', text: '等于' },
            { value: 'notEquals', text: '不等于' },
            { value: 'startsWith', text: '开头是' },
            { value: 'endsWith', text: '结尾是' },
            { value: 'isEmpty', text: '为空' },
            { value: 'isNotEmpty', text: '不为空' }
        ];
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            selectElement.appendChild(optionElement);
        });
    }
    
    // 添加数字操作符选项
    addNumberOperatorOptions(selectElement) {
        const options = [
            { value: 'equals', text: '等于' },
            { value: 'notEquals', text: '不等于' },
            { value: 'greaterThan', text: '大于' },
            { value: 'greaterThanOrEquals', text: '大于等于' },
            { value: 'lessThan', text: '小于' },
            { value: 'lessThanOrEquals', text: '小于等于' },
            { value: 'between', text: '范围' },
            { value: 'isEmpty', text: '为空' },
            { value: 'isNotEmpty', text: '不为空' }
        ];
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            selectElement.appendChild(optionElement);
        });
    }
    
    // 添加日期操作符选项
    addDateOperatorOptions(selectElement) {
        const options = [
            { value: 'equals', text: '等于' },
            { value: 'notEquals', text: '不等于' },
            { value: 'greaterThan', text: '晚于' },
            { value: 'greaterThanOrEquals', text: '晚于等于' },
            { value: 'lessThan', text: '早于' },
            { value: 'lessThanOrEquals', text: '早于等于' },
            { value: 'between', text: '范围' },
            { value: 'isEmpty', text: '为空' },
            { value: 'isNotEmpty', text: '不为空' }
        ];
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            selectElement.appendChild(optionElement);
        });
    }
    
    // 应用数据筛选
    applyDataFilter() {
        // 获取筛选条件数量
        const filterCountSelect = document.getElementById('filterCountSelect');
        const filterCount = parseInt(filterCountSelect?.value) || 2;
        
        // 收集所有筛选条件
        let filters = [];
        
        for (let i = 0; i < filterCount; i++) {
            const filterColumn = document.getElementById(`filterColumnSelect${i}`)?.value;
            const filterOperator = document.getElementById(`filterOperatorSelect${i}`)?.value;
            
            // 如果没有选择列，跳过这个条件
            if (!filterColumn) continue;
            
            // 获取筛选值
            let filterValue = '';
            if (filterOperator === 'between') {
                const filterColumnSelect = document.getElementById(`filterColumnSelect${i}`);
                if (filterColumnSelect) {
                    const columnType = this.getColumnType(filterColumn);
                    if (columnType === 'date') {
                        const startDate = document.getElementById(`filterDateRangeStart${i}`)?.value;
                        const endDate = document.getElementById(`filterDateRangeEnd${i}`)?.value;
                        if (startDate && endDate) {
                            // 自动调整日期顺序，确保startDate <= endDate
                            const start = new Date(startDate);
                            const end = new Date(endDate);
                            if (start > end) {
                                // 如果起始日期晚于结束日期，交换它们
                                filterValue = `${endDate}~${startDate}`;
                            } else {
                                filterValue = `${startDate}~${endDate}`;
                            }
                        }
                    } else if (columnType === 'number') {
                        const min = document.getElementById(`filterNumberRangeMin${i}`)?.value.trim();
                        const max = document.getElementById(`filterNumberRangeMax${i}`)?.value.trim();
                        if (min && max) {
                            const minValue = parseFloat(min);
                            const maxValue = parseFloat(max);
                            // 自动调整数字范围顺序，确保minValue <= maxValue
                            if (minValue > maxValue) {
                                filterValue = `${maxValue}~${minValue}`;
                            } else {
                                filterValue = `${min}~${max}`;
                            }
                        }
                    } else {
                        filterValue = document.getElementById(`filterValueInput${i}`)?.value.trim();
                    }
                }
            } else {
                const valueSelect = document.getElementById(`filterValueSelect${i}`);
                const valueInput = document.getElementById(`filterValueInput${i}`);
                
                if (valueSelect && valueSelect.value !== '') {
                    filterValue = valueSelect.value;
                } else if (valueInput) {
                    filterValue = valueInput.value.trim();
                }
            }
            
            // 获取排序选项
            const filterSortSelect = document.getElementById(`filterSortSelect${i}`);
            const filterSortCountInput = document.getElementById(`filterSortCountInput${i}`);
            const sortOption = filterSortSelect?.value;
            const sortCount = parseInt(filterSortCountInput?.value) || 10;
            
            // 检查是否需要筛选值（除了排序操作）
            const operatorsWithoutValue = ['isEmpty', 'isNotEmpty'];
            if (!operatorsWithoutValue.includes(filterOperator) && !filterValue && !sortOption) {
                // 不再弹出提示，而是记录错误并继续处理
                console.warn(`条件${i+1}：缺少筛选值，跳过此条件`);
                continue;
            }
            
            filters.push({
                column: filterColumn,
                operator: filterOperator,
                value: filterValue,
                sortOption: sortOption,  // 添加排序选项
                sortCount: sortCount     // 添加排序数量
            });
        }
        
        // 应用所有筛选条件
        let filteredData = this.originalData;
        
        for (const filter of filters) {
            const columnType = this.getColumnType(filter.column);
            
            switch (columnType) {
                case 'number':
                    filteredData = this.applyNumberFilter(filter.column, filter.operator, filter.value, filteredData);
                    break;
                case 'date':
                    filteredData = this.applyDateFilter(filter.column, filter.operator, filter.value, filteredData);
                    break;
                default:
                    filteredData = this.applyTextFilter(filter.column, filter.operator, filter.value, filteredData);
                    break;
            }
        }
        
        // 应用排序
        for (const filter of filters) {
            if (filter.sortOption) {
                const columnType = this.getColumnType(filter.column);
                if (columnType === 'number' || columnType === 'date') {
                    filteredData = this.applySortFilter(filter.column, filter.sortOption, filter.sortCount, filteredData, columnType);
                }
            }
        }
        
        // 更新筛选后的数据
        this.filteredData = filteredData;
        
        // 显示筛选结果
        this.displayPreview();
        
        // 显示筛选信息
        console.log(`应用了 ${filters.length} 个筛选条件`);
        console.log(`筛选结果: ${filteredData.length} 条记录`);
    }
    
    // 应用文本筛选（支持传入已筛选数据）
    applyTextFilter(column, operator, value, data = null) {
        const sourceData = data || this.originalData;
        
        return sourceData.filter(row => {
            const cellValue = String(row[column] !== undefined && row[column] !== null ? row[column] : '').toLowerCase();
            const searchValue = value.toLowerCase();
            
            switch (operator) {
                case 'contains':
                    return cellValue.includes(searchValue);
                case 'equals':
                    return cellValue === searchValue;
                case 'notEquals':
                    return cellValue !== searchValue;
                case 'startsWith':
                    return cellValue.startsWith(searchValue);
                case 'endsWith':
                    return cellValue.endsWith(searchValue);
                case 'isEmpty':
                    return row[column] === undefined || row[column] === null || String(row[column]).trim() === '';
                case 'isNotEmpty':
                    return row[column] !== undefined && row[column] !== null && String(row[column]).trim() !== '';
                default:
                    return true;
            }
        });
    }
    

    

    

    

    
    // 导入模板功能
    importTemplate(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        // 限制最多导入十个模板
        if (files.length > 10) {
            alert('最多只能同时导入10个模板文件');
            return;
        }
        
        // 用于存储处理结果
        const results = {
            success: [],
            errors: []
        };
        
        // 检查当前数据是否匹配模板
        if (this.originalHeaders.length === 0) {
            alert('请先导入数据文件再应用模板');
            return;
        }
        
        // 保存模板文件列表，用于后续的按模板导出功能
        this.templateFiles = Array.from(files);
        
        // 处理每个模板文件
        let processedCount = 0;
        const totalFiles = files.length;
        
        // 创建处理函数
        const processNextFile = (index) => {
            if (index >= totalFiles) {
                // 所有文件处理完成，显示结果报告
                console.log(`所有模板文件处理完成，成功: ${results.success.length}, 失败: ${results.errors.length}`);
                this.showImportResults(results);
                return;
            }
            
            const file = files[index];
            console.log(`正在处理模板文件 ${index + 1}/${totalFiles}: ${file.name}`);
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const template = JSON.parse(e.target.result);
                    
                    // 验证模板格式
                    if (!template.headers || !Array.isArray(template.headers)) {
                        // 模板格式不正确，直接跳过，不提示用户
                        results.errors.push({
                            filename: file.name,
                            error: '无效的模板格式：缺少表头信息'
                        });
                        processNextFile(index + 1);
                        return;
                    }
                    
                    // 检查表头是否匹配
                    const missingHeaders = template.headers.filter(header => 
                        !this.originalHeaders.includes(header)
                    );
                    
                    if (missingHeaders.length > 0) {
                        // 表头不匹配，直接跳过，不提示用户
                        results.errors.push({
                            filename: file.name,
                            error: `以下表头在当前数据中不存在：${missingHeaders.join(', ')}`
                        });
                        processNextFile(index + 1);
                        return;
                    }
                    
                    // 应用模板（仅应用，不导出）
                    this.applyTemplate(template, file.name, results, () => {
                        console.log(`模板 ${file.name} 应用完成`);
                        processNextFile(index + 1);
                    });
                } catch (error) {
                    // 模板解析失败，直接跳过
                    results.errors.push({
                        filename: file.name,
                        error: error.message
                    });
                    processNextFile(index + 1);
                }
            };
            
            reader.onerror = () => {
                // 文件读取失败，直接跳过
                results.errors.push({
                    filename: file.name,
                    error: '文件读取失败'
                });
                processNextFile(index + 1);
            };
            
            reader.readAsText(file, 'UTF-8');
        };
        
        // 开始处理第一个文件
        processNextFile(0);
    }
    
    // 修改 applyTemplate 函数以保存模板名
    // 应用模板（仅应用，不导出）
    applyTemplate(template, filename, results, callback) {
        try {
            // 保存模板名（移除.json扩展名）
            this.currentTemplateName = filename.replace('.json', '');
            
            // 应用表头选择
            this.selectedHeaders = [...template.headers];
            this.updateSelectedHeaders();
            
            // 应用筛选条件（如果有）
            if (template.filters && Array.isArray(template.filters)) {
                // 等待DOM更新完成后再设置筛选条件
                setTimeout(() => {
                    this.applyTemplateFilters(template.filters, () => {
                        // 筛选完成后显示预览
                        setTimeout(() => {
                            this.generatePreview();
                            // 记录成功结果
                            results.success.push({
                                template: filename,
                                message: '模板应用成功'
                            });
                            callback();
                        }, 100);
                    });
                }, 100);
            } else {
                // 没有筛选条件，直接显示预览
                setTimeout(() => {
                    this.generatePreview();
                    // 记录成功结果
                    results.success.push({
                        template: filename,
                        message: '模板应用成功'
                    });
                    callback();
                }, 100);
            }
        } catch (error) {
            results.errors.push({
                filename: filename,
                error: error.message
            });
            callback();
        }
    }
    
    // 显示导入结果报告
    showImportResults(results) {
        let message = `模板导入完成！\n\n`;
        
        if (results.success.length > 0) {
            message += `成功应用 ${results.success.length} 个模板：\n`;
            results.success.forEach(item => {
                message += `- ${item.template}: ${item.message}\n`;
            });
            message += `\n`;
        }
        
        if (results.errors.length > 0) {
            message += `导入失败 ${results.errors.length} 个模板：\n`;
            results.errors.forEach(item => {
                message += `- ${item.filename}: ${item.error}\n`;
            });
        }
        
        // 只有当有错误或成功时才显示提示
        if (results.errors.length > 0 || results.success.length > 0) {
            alert(message);
        }
    }
    
    // 导出数据（根据模板）
    exportDataWithTemplate(templateFilename, results, callback) {
        try {
            if (this.filteredData.length === 0) {
                // 如果没有筛选数据，则使用原始数据
                this.filteredData = this.originalData;
            }
            
            // 清理模板文件名，移除扩展名
            const cleanTemplateName = templateFilename.replace('.json', '');
            
            // 生成导出文件名（导入文件名-模板名-日期时间-批次）
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            
            // 使用当前文件名（可能包含多个文件的信息）
            let baseFilename = this.currentFileName || 'data';
            // 如果是合并数据，提取基础文件名
            if (baseFilename.startsWith('合并数据')) {
                baseFilename = 'merged_data';
            } else {
                // 移除文件扩展名
                baseFilename = baseFilename.replace(/\.[^\.]+$/, '');
            }
            
            const exportFilename = `${baseFilename}-${cleanTemplateName}-${dateStr}-${timeStr}`;
            
            // 获取用户选择的导出格式
            const exportFormat = document.getElementById('exportFormat')?.value || 'csv';
            const fullExportFilename = `${exportFilename}.${exportFormat}`;
            
            // 准备导出数据
            const cleanHeaders = this.selectedHeaders.map(header => 
                String(header).replace(/[×*+]/g, '').trim()
            );
            
            const exportData = this.filteredData.map(row => {
                const cleanedRow = {};
                this.selectedHeaders.forEach((originalHeader, index) => {
                    const cleanHeader = cleanHeaders[index];
                    cleanedRow[cleanHeader] = row[originalHeader] !== undefined && row[originalHeader] !== null ? row[originalHeader] : '';
                });
                return cleanedRow;
            });
            
            // 执行导出
            if (exportFormat === 'xlsx' || exportFormat === 'xls') {
                ExcelHelper.download(exportData, cleanHeaders, fullExportFilename);
            } else {
                ExcelHelper.downloadCsv(exportData, cleanHeaders, fullExportFilename);
            }
            
            // 记录成功结果
            results.success.push({
                template: templateFilename,
                exported: fullExportFilename
            });
            
            callback();
        } catch (error) {
            console.error('导出数据时发生错误:', error);
            callback();
        }
    }
    
    // 导出数据（根据模板）
    exportDataWithTemplate(templateFilename, results, callback) {
        try {
            if (this.filteredData.length === 0) {
                // 如果没有筛选数据，则使用原始数据
                this.filteredData = this.originalData;
            }
            
            // 获取用户选择的导出格式
            const exportFormat = document.getElementById('exportFormat')?.value || 'csv';
            
            // 检查是否是合并数据且有多个导入文件
            if (this.currentFileName && this.currentFileName.startsWith('合并数据') && this.importedFileNames && this.importedFileNames.length > 0) {
                // 为每个导入的文件分别导出
                this.importedFileNames.forEach((fileName, index) => {
                    // 提取文件名（不包括扩展名）
                    const baseFilename = fileName.replace(/\.[^\.]+$/, '');
                    
                    // 清理模板文件名，移除扩展名
                    const cleanTemplateName = templateFilename.replace('.json', '');
                    
                    // 生成导出文件名（导入文件名-模板名-日期时间-批次）
                    const now = new Date();
                    const dateStr = now.toISOString().split('T')[0];
                    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
                    
                    const exportFilename = `${baseFilename}-${cleanTemplateName}-${dateStr}-${timeStr}`;
                    const fullExportFilename = `${exportFilename}.${exportFormat}`;
                    
                    // 筛选当前文件的数据
                    const fileData = this.filteredData.filter(row => row['数据来源'] === fileName);
                    
                    // 准备导出数据
                    const cleanHeaders = this.selectedHeaders.map(header => 
                        String(header).replace(/[×*+]/g, '').trim()
                    );
                    
                    const exportData = fileData.map(row => {
                        const cleanedRow = {};
                        this.selectedHeaders.forEach((originalHeader, idx) => {
                            const cleanHeader = cleanHeaders[idx];
                            cleanedRow[cleanHeader] = row[originalHeader] !== undefined && row[originalHeader] !== null ? row[originalHeader] : '';
                        });
                        return cleanedRow;
                    });
                    
                    // 执行导出
                    if (exportData.length > 0) {  // 只有当有数据时才导出
                        if (exportFormat === 'xlsx' || exportFormat === 'xls') {
                            ExcelHelper.download(exportData, cleanHeaders, fullExportFilename);
                        } else {
                            ExcelHelper.downloadCsv(exportData, cleanHeaders, fullExportFilename);
                        }
                        
                        // 记录成功结果
                        results.success.push({
                            template: templateFilename,
                            exported: fullExportFilename
                        });
                        
                        console.log('按模板导出完成:', fullExportFilename);
                    }
                });
            } else {
                // 单个文件导出
                // 清理模板文件名，移除扩展名
                const cleanTemplateName = templateFilename.replace('.json', '');
                
                // 生成导出文件名（导入文件名-模板名-日期时间-批次）
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
                
                // 使用当前文件名（可能包含多个文件的信息）
                let baseFilename = this.currentFileName || 'data';
                // 如果是合并数据，提取基础文件名
                if (baseFilename.startsWith('合并数据')) {
                    baseFilename = 'merged_data';
                } else {
                    // 移除文件扩展名
                    baseFilename = baseFilename.replace(/\.[^\.]+$/, '');
                }
                
                const exportFilename = `${baseFilename}-${cleanTemplateName}-${dateStr}-${timeStr}`;
                
                const fullExportFilename = `${exportFilename}.${exportFormat}`;
                
                // 准备导出数据
                const cleanHeaders = this.selectedHeaders.map(header => 
                    String(header).replace(/[×*+]/g, '').trim()
                );
                
                const exportData = this.filteredData.map(row => {
                    const cleanedRow = {};
                    this.selectedHeaders.forEach((originalHeader, index) => {
                        const cleanHeader = cleanHeaders[index];
                        cleanedRow[cleanHeader] = row[originalHeader] !== undefined && row[originalHeader] !== null ? row[originalHeader] : '';
                    });
                    return cleanedRow;
                });
                
                // 执行导出
                if (exportFormat === 'xlsx' || exportFormat === 'xls') {
                    ExcelHelper.download(exportData, cleanHeaders, fullExportFilename);
                } else {
                    ExcelHelper.downloadCsv(exportData, cleanHeaders, fullExportFilename);
                }
                
                // 记录成功结果
                results.success.push({
                    template: templateFilename,
                    exported: fullExportFilename
                });
                
                console.log('按模板导出完成:', fullExportFilename);
            }
            
            callback();
        } catch (error) {
            results.errors.push({
                filename: templateFilename,
                error: error.message
            });
            callback();
        }
    }
    
    // 应用模板并导出数据
    applyTemplateAndExport(template, filename, results, callback) {
        try {
            // 应用表头选择
            this.selectedHeaders = [...template.headers];
            this.updateSelectedHeaders();
            
            // 应用筛选条件（如果有）
            if (template.filters && Array.isArray(template.filters)) {
                // 等待DOM更新完成后再设置筛选条件
                setTimeout(() => {
                    this.applyTemplateFilters(template.filters, () => {
                        // 筛选完成后导出数据
                        setTimeout(() => {
                            this.exportDataWithTemplate(filename, results, callback);
                        }, 100);
                    });
                }, 100);
            } else {
                // 没有筛选条件，直接导出数据
                setTimeout(() => {
                    this.exportDataWithTemplate(filename, results, callback);
                }, 100);
            }
        } catch (error) {
            results.errors.push({
                filename: filename,
                error: error.message
            });
            callback();
        }
    }
    
    // 读取模板文件并处理
    /*
    readTemplateFiles(templateFiles, callback) {
        const results = {
            files: [],
            errors: []
        };

        // 处理单个文件的函数
        function processNextFile(index) {
            if (index >= templateFiles.length) {
                callback(results);
                return;
            }

            const templateFilename = templateFiles[index];
            fs.readFile(templateFilename, 'utf8', (err, data) => {
                if (err) {
                    results.errors.push({
                        filename: templateFilename,
                        error: err.message
                    });
                    processNextFile(index + 1);
                } else {
                    results.files.push({
                        filename: templateFilename,
                        content: data
                    });
                    processNextFile(index + 1);
                }
            });
        }
        
        processNextFile(0);
    }
    */
    
    // 按模板导出功能
    exportByTemplate() {
        // 检查是否有选中的表头
        if (this.selectedHeaders.length === 0) {
            alert('请先选择表头再导出数据');
            return;
        }
        
        // 检查是否有筛选数据
        if (!this.originalData || this.originalData.length === 0) {
            alert('没有数据可导出');
            return;
        }
        
        // 检查是否已导入模板文件
        if (!this.templateFiles || this.templateFiles.length === 0) {
            alert('请先导入模板文件');
            return;
        }
        
        // 用于存储处理结果
        const results = {
            success: [],
            errors: []
        };
        
        // 使用当前时间生成文件名
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        
        // 获取用户选择的导出格式
        const exportFormat = document.getElementById('exportFormat')?.value || 'csv';
        
        // 检查是否有导入的文件名列表（用于合并数据）
        if (this.importedFileNames && this.importedFileNames.length > 0) {
            // 为每个导入的文件和每个模板文件组合生成导出文件
            this.importedFileNames.forEach((fileName, fileIndex) => {
                // 提取文件名（不包括扩展名）
                const baseFilename = fileName.replace(/\.[^\.]+$/, '');
                
                // 为每个模板文件分别处理
                this.templateFiles.forEach((templateFile, templateIndex) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const template = JSON.parse(e.target.result);
                            // 保存模板名（移除.json扩展名）
                            const templateName = templateFile.name.replace('.json', '');
                            
                            // 生成符合要求的文件名格式：{导入文件名}-{模板名}-{日期时间}
                            const exportFilename = `${baseFilename}-${templateName}-${dateStr}-${timeStr}`;
                            const fullExportFilename = `${exportFilename}.${exportFormat}`;
                            
                            // 筛选当前文件的数据（使用原始数据，不修改this.filteredData）
                            let fileData = this.originalData.filter(row => row['数据来源'] === fileName);
                            
                            // 如果模板中有筛选条件，应用这些条件
                            if (template.filters && Array.isArray(template.filters) && template.filters.length > 0) {
                                // 应用筛选条件到当前文件数据
                                template.filters.forEach(filter => {
                                    const columnType = this.getColumnType(filter.column);
                                    
                                    switch (columnType) {
                                        case 'number':
                                            fileData = this.applyNumberFilter(filter.column, filter.operator, filter.value, fileData);
                                            break;
                                        case 'date':
                                            fileData = this.applyDateFilter(filter.column, filter.operator, filter.value, fileData);
                                            break;
                                        default:
                                            fileData = this.applyTextFilter(filter.column, filter.operator, filter.value, fileData);
                                            break;
                                    }
                                    
                                    // 应用排序
                                    if (filter.sortOption) {
                                        if (columnType === 'number' || columnType === 'date') {
                                            fileData = this.applySortFilter(filter.column, filter.sortOption, filter.sortCount, fileData, columnType);
                                        }
                                    }
                                });
                            }
                            
                            // 准备导出数据
                            const cleanHeaders = this.selectedHeaders.map(header => 
                                String(header).replace(/[×*+]/g, '').trim()
                            );
                            
                            const exportData = fileData.map(row => {
                                const cleanedRow = {};
                                this.selectedHeaders.forEach((originalHeader, idx) => {
                                    const cleanHeader = cleanHeaders[idx];
                                    cleanedRow[cleanHeader] = row[originalHeader] !== undefined && row[originalHeader] !== null ? row[originalHeader] : '';
                                });
                                return cleanedRow;
                            });
                            
                            // 执行导出
                            if (exportData.length > 0) {  // 只有当有数据时才导出
                                if (exportFormat === 'xlsx' || exportFormat === 'xls') {
                                    ExcelHelper.download(exportData, cleanHeaders, fullExportFilename);
                                    results.success.push({
                                        template: templateFile.name,
                                        exported: fullExportFilename
                                    });
                                } else {
                                    ExcelHelper.downloadCsv(exportData, cleanHeaders, fullExportFilename);
                                    results.success.push({
                                        template: templateFile.name,
                                        exported: fullExportFilename
                                    });
                                }
                                
                                console.log('按模板导出完成:', fullExportFilename);
                            } else {
                                // 数据为空，记录但不导出
                                results.errors.push({
                                    filename: templateFile.name,
                                    error: `文件 ${fileName} 与模板 ${templateFile.name} 不匹配`
                                });
                            }
                            
                            // 如果是最后一个文件和模板，显示结果
                            const isLastFile = fileIndex === this.importedFileNames.length - 1;
                            const isLastTemplate = templateIndex === this.templateFiles.length - 1;
                            if (isLastFile && isLastTemplate) {
                                this.showExportResults(results);
                            }
                        } catch (error) {
                            console.error('解析模板文件时发生错误:', error);
                            results.errors.push({
                                filename: templateFile.name,
                                error: `解析模板文件时发生错误: ${error.message}`
                            });
                            
                            // 如果是最后一个文件和模板，显示结果
                            const isLastFile = fileIndex === this.importedFileNames.length - 1;
                            const isLastTemplate = templateIndex === this.templateFiles.length - 1;
                            if (isLastFile && isLastTemplate) {
                                this.showExportResults(results);
                            }
                        }
                    };
                    reader.readAsText(templateFile, 'UTF-8');
                });
            });
        } else {
            // 单个文件导出
            let baseFilename = this.currentFileName || 'data';
            // 移除文件扩展名
            baseFilename = baseFilename.replace(/\.[^\.]+$/, '');
            
            // 跟踪处理进度
            let processedTemplates = 0;
            
            // 为每个模板文件分别处理
            this.templateFiles.forEach((templateFile, templateIndex) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const template = JSON.parse(e.target.result);
                        // 保存模板名（移除.json扩展名）
                        const templateName = templateFile.name.replace('.json', '');
                        
                        // 生成符合要求的文件名格式：{导入文件名}-{模板名}-{日期时间}
                        const exportFilename = `${baseFilename}-${templateName}-${dateStr}-${timeStr}`;
                        const fullExportFilename = `${exportFilename}.${exportFormat}`;
                        
                        // 准备导出数据（使用原始数据，不修改this.filteredData）
                        let exportData = this.originalData;
                        
                        // 如果模板中有筛选条件，应用这些条件
                        if (template.filters && Array.isArray(template.filters) && template.filters.length > 0) {
                            // 应用筛选条件到原始数据
                            template.filters.forEach(filter => {
                                const columnType = this.getColumnType(filter.column);
                                
                                switch (columnType) {
                                    case 'number':
                                        exportData = this.applyNumberFilter(filter.column, filter.operator, filter.value, exportData);
                                        break;
                                    case 'date':
                                        exportData = this.applyDateFilter(filter.column, filter.operator, filter.value, exportData);
                                        break;
                                    default:
                                        exportData = this.applyTextFilter(filter.column, filter.operator, filter.value, exportData);
                                        break;
                                }
                                
                                // 应用排序
                                if (filter.sortOption) {
                                    if (columnType === 'number' || columnType === 'date') {
                                        exportData = this.applySortFilter(filter.column, filter.sortOption, filter.sortCount, exportData, columnType);
                                    }
                                }
                            });
                        }
                        
                        const cleanHeaders = this.selectedHeaders.map(header => 
                            String(header).replace(/[×*+]/g, '').trim()
                        );
                        
                        const finalExportData = exportData.map(row => {
                            const cleanedRow = {};
                            this.selectedHeaders.forEach((originalHeader, idx) => {
                                const cleanHeader = cleanHeaders[idx];
                                cleanedRow[cleanHeader] = row[originalHeader] !== undefined && row[originalHeader] !== null ? row[originalHeader] : '';
                            });
                            return cleanedRow;
                        });
                        
                        // 执行导出
                        if (exportFormat === 'xlsx' || exportFormat === 'xls') {
                            ExcelHelper.download(finalExportData, cleanHeaders, fullExportFilename);
                            results.success.push({
                                template: templateFile.name,
                                exported: fullExportFilename
                            });
                        } else {
                            ExcelHelper.downloadCsv(finalExportData, cleanHeaders, fullExportFilename);
                            results.success.push({
                                template: templateFile.name,
                                exported: fullExportFilename
                            });
                        }
                        
                        console.log('按模板导出完成:', fullExportFilename);
                    } catch (error) {
                        console.error('解析模板文件时发生错误:', error);
                        results.errors.push({
                            filename: templateFile.name,
                            error: `解析模板文件时发生错误: ${error.message}`
                        });
                    } finally {
                        processedTemplates++;
                        // 如果是最后一个模板，显示结果
                        if (processedTemplates === this.templateFiles.length) {
                            this.showExportResults(results);
                        }
                    }
                };
                reader.readAsText(templateFile, 'UTF-8');
            });
        }
    }
    
    // 显示导出结果报告
    showExportResults(results) {
        let message = `按模板导出完成！\n\n`;
        
        if (results.success.length > 0) {
            message += `成功导出 ${results.success.length} 个文件：\n`;
            results.success.forEach(item => {
                message += `- ${item.exported}\n`;
            });
            message += `\n`;
        }
        
        if (results.errors.length > 0) {
            message += `导出失败 ${results.errors.length} 个模板：\n`;
            results.errors.forEach(item => {
                message += `- ${item.filename}: ${item.error}\n`;
            });
        }
        
        // 只有当有错误或成功时才显示提示
        if (results.errors.length > 0 || results.success.length > 0) {
            alert(message);
        }
    }
    
    // 获取拖拽元素之后的元素
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.header-chip:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    

    
    applySortFilter(column, sortOption, sortCount, data, columnType) {
        const sourceData = data || this.originalData;
        
        return sourceData.sort((a, b) => {
            const aValue = a[column];
            const bValue = b[column];
            
            if (columnType === 'number') {
                const numA = parseFloat(aValue);
                const numB = parseFloat(bValue);
                
                if (isNaN(numA) && isNaN(numB)) return 0;
                if (isNaN(numA)) return 1;
                if (isNaN(numB)) return -1;
                
                return sortOption === 'asc' ? numA - numB : numB - numA;
            } else if (columnType === 'date') {
                const dateA = new Date(aValue);
                const dateB = new Date(bValue);
                
                if (isNaN(dateA) && isNaN(dateB)) return 0;
                if (isNaN(dateA)) return 1;
                if (isNaN(dateB)) return -1;
                
                return sortOption === 'asc' ? dateA - dateB : dateB - dateA;
            } else {
                const strA = String(aValue || '').toLowerCase();
                const strB = String(bValue || '').toLowerCase();
                
                return sortOption === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
            }
        }).slice(0, sortCount);
    }
    

    

    

    

    
    // 设置筛选值

    
    // 导入模板功能

    
    // 应用日期筛选（支持传入已筛选数据）
    applyDateFilter(column, operator, value, data = null) {
        const sourceData = data || this.originalData;
        
        // 处理范围筛选
        if (operator === 'between') {
            const parts = value.split('~');
            if (parts.length !== 2) {
                alert('请输入正确的日期范围格式：开始日期~结束日期');
                return sourceData;
            }
            
            const startDateStr = parts[0].trim();
            const endDateStr = parts[1].trim();
            
            // 尝试解析日期
            const startDate = this.parseDate(startDateStr);
            const endDate = this.parseDate(endDateStr);
            
            if (!startDate || !endDate) {
                alert('请输入有效的日期范围');
                return sourceData;
            }
            
            return sourceData.filter(row => {
                const cellValue = row[column];
                if (cellValue === undefined || cellValue === null || String(cellValue).trim() === '') {
                    return false;
                }
                
                const cellDate = this.parseDate(cellValue);
                if (!cellDate) {
                    return false;
                }
                
                // 日期比较
                return cellDate >= startDate && cellDate <= endDate;
            });
        }
        
        // 处理单值筛选
        let dateValue = null;
        if (value) {
            dateValue = this.parseDate(value);
        }
        
        return sourceData.filter(row => {
            const cellValue = row[column];
            
            // 处理空值情况
            if (operator === 'isEmpty') {
                return cellValue === undefined || cellValue === null || String(cellValue).trim() === '';
            }
            
            if (operator === 'isNotEmpty') {
                return cellValue !== undefined && cellValue !== null && String(cellValue).trim() !== '';
            }
            
            // 如果筛选值不是有效日期，对于需要日期的操作符返回false
            if (!dateValue && operator !== 'isEmpty' && operator !== 'isNotEmpty') {
                return false;
            }
            
            // 如果单元格值为空，对于比较操作符返回false
            if (cellValue === undefined || cellValue === null || String(cellValue).trim() === '') {
                return false;
            }
            
            const cellDate = this.parseDate(cellValue);
            if (!cellDate) {
                return false;
            }
            
            switch (operator) {
                case 'equals':
                    return cellDate.getTime() === dateValue.getTime();
                case 'notEquals':
                    return cellDate.getTime() !== dateValue.getTime();
                case 'greaterThan':
                    return cellDate > dateValue;
                case 'greaterThanOrEquals':
                    return cellDate >= dateValue;
                case 'lessThan':
                    return cellDate < dateValue;
                case 'lessThanOrEquals':
                    return cellDate <= dateValue;
                default:
                    return true;
            }
        });
    }
    
    // 应用排序筛选
    applySortFilter(column, sortOption, sortCount, data, columnType) {
        const sourceData = data || this.originalData;
        
        // 先根据列值排序（升序）
        let sortedData = [...sourceData];
        
        if (columnType === 'number') {
            sortedData.sort((a, b) => {
                const aValue = parseFloat(a[column]);
                const bValue = parseFloat(b[column]);
                
                // 处理NaN值
                if (isNaN(aValue) && isNaN(bValue)) return 0;
                if (isNaN(aValue)) return 1;
                if (isNaN(bValue)) return -1;
                
                return aValue - bValue;
            });
        } else if (columnType === 'date') {
            sortedData.sort((a, b) => {
                const aDate = this.parseDate(a[column]);
                const bDate = this.parseDate(b[column]);
                
                // 处理无效日期
                if (!aDate && !bDate) return 0;
                if (!aDate) return 1;
                if (!bDate) return -1;
                
                return aDate.getTime() - bDate.getTime();
            });
        }
        
        // 根据排序选项应用排序
        switch (sortOption) {
            case 'all':
                // 全部，返回所有数据
                return sortedData;
            case 'asc':
                // 降序，返回从高到低的排序结果
                return sortedData.reverse();
            case 'desc':
                // 升序，返回从低到高的排序结果
                return sortedData;
            case 'top':
                // 前N名，取排序后的后N个（因为是升序排列，需要取后N个再反转）
                return sortedData.slice(-Math.min(sortCount, sortedData.length)).reverse();
            case 'bottom':
                // 后N名，取排序后的前N个（因为是升序排列，需要取前N个）
                return sortedData.slice(0, Math.min(sortCount, sortedData.length));
            default:
                return sortedData;
        }
    }
    
    // 清除数据筛选
    clearDataFilter() {
        // 清空筛选输入
        const filterCountSelect = document.getElementById('filterCountSelect');
        const filterCount = parseInt(filterCountSelect?.value) || 2;
        
        for (let i = 0; i < filterCount; i++) {
            const columnSelect = document.getElementById(`filterColumnSelect${i}`);
            const operatorSelect = document.getElementById(`filterOperatorSelect${i}`);
            const valueSelect = document.getElementById(`filterValueSelect${i}`);
            const valueInput = document.getElementById(`filterValueInput${i}`);
            const dateRangeStart = document.getElementById(`filterDateRangeStart${i}`);
            const dateRangeEnd = document.getElementById(`filterDateRangeEnd${i}`);
            const numberRangeMin = document.getElementById(`filterNumberRangeMin${i}`);
            const numberRangeMax = document.getElementById(`filterNumberRangeMax${i}`);
            
            if (columnSelect) columnSelect.value = '';
            if (operatorSelect) operatorSelect.value = 'contains';
            if (valueSelect) valueSelect.value = '';
            if (valueInput) valueInput.value = '';
            if (dateRangeStart) dateRangeStart.value = '';
            if (dateRangeEnd) dateRangeEnd.value = '';
            if (numberRangeMin) numberRangeMin.value = '';
            if (numberRangeMax) numberRangeMax.value = '';
        }
        
        // 清空筛选值下拉列表选项
        for (let i = 0; i < filterCount; i++) {
            const filterValueSelect = document.getElementById(`filterValueSelect${i}`);
            if (filterValueSelect) {
                while (filterValueSelect.options.length > 1) {
                    filterValueSelect.remove(1);
                }
            }
        }
        
        // 恢复原始数据，但确保不为null
        this.filteredData = this.originalData || [];
        
        // 显示预览
        this.displayPreview();
        
        console.log('已清除数据筛选');
    }

    // 生成预览
    generatePreview() {
        // 检查是否有选中的表头
        if (this.selectedHeaders.length === 0) {
            this.showSelectHeaderMessage();
            return;
        }

        // 如果还没有筛选数据，则使用原始数据
        let dataToDisplay = this.filteredData;
        if (!this.filteredData || this.filteredData.length === 0) {
            dataToDisplay = this.originalData;
        }

        this.displayPreviewWithHeaders(this.selectedHeaders, dataToDisplay);
    }

    // 显示预览表格（指定表头）
    displayPreviewWithHeaders(headers, data) {
        const table = document.getElementById('previewTable');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        // 清理表头名称，移除可能的特殊字符
        const cleanHeaders = headers.map(header => 
            String(header).replace(/[×*+]/g, '').trim()
        );

        // 生成表头
        thead.innerHTML = `
            <tr>
                ${cleanHeaders.map(header => 
                    `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${header}</th>`
                ).join('')}
            </tr>
        `;

        // 生成数据行（显示前50行）
        const displayData = data.slice(0, 50);
        tbody.innerHTML = displayData.map(row => `
            <tr class="hover:bg-gray-50">
                ${cleanHeaders.map(header => 
                    `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${this.escapeHtml(row[header])}</td>`
                ).join('')}
            </tr>
        `).join('');

        // 更新统计信息
        const statsDiv = document.getElementById('dataStats');
        statsDiv.innerHTML = `
            <div class="flex justify-between items-center">
                <span>共 ${data.length} 行数据，显示前 ${Math.min(50, data.length)} 行</span>
                <span>已选择 ${this.selectedHeaders.length} 列</span>
            </div>
        `;

        this.showPreview();
    }

    // HTML转义
    escapeHtml(text) {
        // 处理0值等特殊情况，确保它们能正确显示
        if (text === 0 || text === '0') {
            console.log('escapeHtml: 处理0值，返回"0"');
            return '0';
        }
        const div = document.createElement('div');
        div.textContent = text;
        const result = div.innerHTML;
        console.log('escapeHtml: 输入:', text, '输出:', result);
        return result;
    }

    // 导出到Excel
    exportToExcel() {
        if (this.filteredData.length === 0) {
            alert('没有数据可导出');
            return;
        }

        try {
            // 获取用户选择的导出格式
            const exportFormat = document.getElementById('exportFormat').value || 'csv';
            
            // 清理表头名称，移除可能的特殊字符
            const cleanHeaders = this.selectedHeaders.map(header => 
                String(header).replace(/[×*+]/g, '').trim()
            );
            
            console.log('导出调试信息:');
            console.log('原始表头:', this.selectedHeaders);
            console.log('清理后表头:', cleanHeaders);
            console.log('过滤数据样例:', this.filteredData.slice(0, 2));
            
            // 重新映射数据，使用清理后的表头作为键
            const cleanedData = this.filteredData.map(row => {
                const cleanedRow = {};
                this.selectedHeaders.forEach((originalHeader, index) => {
                    const cleanHeader = cleanHeaders[index];
                    cleanedRow[cleanHeader] = row[originalHeader] !== undefined && row[originalHeader] !== null ? row[originalHeader] : '';
                });
                return cleanedRow;
            });
            
            console.log('清理后数据样例:', cleanedData.slice(0, 2));
            
            // 生成文件名（包含格式信息）
            const baseFilename = `筛选数据_${new Date().toISOString().split('T')[0]}`;
            let filename = `${baseFilename}.${exportFormat}`;
            
            // 根据选择的格式导出
            if (exportFormat === 'xlsx' || exportFormat === 'xls') {
                ExcelHelper.download(cleanedData, cleanHeaders, filename);
            } else {
                ExcelHelper.downloadCsv(cleanedData, cleanHeaders, filename);
            }
        } catch (error) {
            alert('导出失败: ' + error.message);
        }
    }
    
    // 按组导出
    exportByGroup() {
        const groupColumnSelect = document.getElementById('groupExportColumn');
        const exportFormat = document.getElementById('exportFormat').value || 'xlsx';
        const selectedColumn = groupColumnSelect.value;
        
        if (!selectedColumn) {
            alert('请选择要分组的列');
            return;
        }
        
        if (this.originalData.length === 0) {
            alert('没有数据可供导出');
            return;
        }
        
        // 按选定列的值进行分组
        const groups = {};
        let totalRows = 0;
        this.originalData.forEach(row => {
            const value = row[selectedColumn] || '未填写';
            if (!groups[value]) {
                groups[value] = [];
            }
            groups[value].push(row);
            totalRows++;
        });
        
        // 获取所有唯一值
        const uniqueValues = Object.keys(groups);
        
        // 调试信息
        console.log('分组统计:');
        console.log('总行数:', totalRows);
        console.log('唯一值数量:', uniqueValues.length);
        uniqueValues.forEach(value => {
            console.log(`${value}: ${groups[value].length} 行`);
        });
        
        // 限制一次最多导出50个文件
        const MAX_EXPORTS_PER_BATCH = 50;
        
        if (uniqueValues.length > MAX_EXPORTS_PER_BATCH) {
            const confirm = window.confirm(`检测到 ${uniqueValues.length} 个不同的${selectedColumn}，超过最大限制 ${MAX_EXPORTS_PER_BATCH} 个。是否继续分批导出？`);
            if (!confirm) {
                return;
            }
        }
        
        // 执行导出
        this.performBatchExport(groups, selectedColumn, exportFormat, MAX_EXPORTS_PER_BATCH);
    }
    
    // 执行批量导出
    performBatchExport(groups, selectedColumn, exportFormat, maxPerBatch) {
        const values = Object.keys(groups);
        let exportedCount = 0;
        
        // 分批处理
        for (let i = 0; i < values.length; i += maxPerBatch) {
            const batchValues = values.slice(i, i + maxPerBatch);
            
            // 确认当前批次
            if (i > 0) {
                const confirm = window.confirm(`正在处理第 ${Math.floor(i / maxPerBatch) + 1} 批次，是否继续导出接下来的 ${Math.min(maxPerBatch, values.length - i)} 个文件？`);
                if (!confirm) {
                    break;
                }
            }
            
            // 显示当前批次信息
            console.log(`开始导出第 ${Math.floor(i / maxPerBatch) + 1} 批次，包含 ${batchValues.length} 个文件`);
            
            // 导出当前批次
            for (const value of batchValues) {
                const data = groups[value];
                const cleanValue = String(value).replace(/[/\\?%*:|"<>]/g, '_'); // 清理文件名非法字符
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `${selectedColumn}_${cleanValue}_${timestamp}.${exportFormat}`;
                
                // 准备数据
                const exportData = data.map(row => {
                    const cleanedRow = {};
                    this.originalHeaders.forEach(header => {
                        cleanedRow[header] = row[header] !== undefined && row[header] !== null ? row[header] : '';
                    });
                    return cleanedRow;
                });
                
                // 使用ExcelHelper导出
                try {
                    if (exportFormat === 'xlsx' || exportFormat === 'xls') {
                        ExcelHelper.download(exportData, this.originalHeaders, filename);
                    } else {
                        ExcelHelper.downloadCsv(exportData, this.originalHeaders, filename);
                    }
                    exportedCount++;
                    console.log(`已触发下载: ${filename}`);
                    
                    // 添加短暂延迟，避免浏览器批量下载限制
                    if (exportedCount % 10 === 0) {
                        console.log(`已触发 ${exportedCount} 个下载，稍作暂停...`);
                        // 简单的同步等待，避免使用异步操作
                        const start = Date.now();
                        while (Date.now() - start < 1000) {
                            // 空循环，阻塞主线程1秒
                        }
                    }
                } catch (error) {
                    console.error(`导出文件 ${filename} 时发生错误:`, error);
                }
            }
        }
    }

    // 清空所有数据
    clearAllData() {
        console.log('clearAllData 被调用');
        this.originalData = null;
        this.originalHeaders = [];
        this.selectedHeaders = [];
        this.filteredData = [];
        this.currentWorkbook = null;
        this.currentFileName = '';
        this.currentRawData = null;
        this.headerRowIndex = 0;

        document.getElementById('fileName').textContent = '未选择文件';
        document.getElementById('clearBtn').style.display = 'none';
        document.getElementById('fileInput').value = '';

        console.log('调用 hideSections');
        this.hideSections();
        console.log('调用 hidePreview');
        this.hidePreview();
        console.log('调用 hideWorksheetSelector');
        this.hideWorksheetSelector();
        console.log('调用 hideHeaderRowSelector');
        this.hideHeaderRowSelector();
        
        // 清空分组导出列选项
        const select = document.getElementById('groupExportColumn');
        if (select) {
            while (select.options.length > 1) {
                select.remove(1);
            }
        }
        
        // 隐藏按模板导出按钮
        const exportByTemplateBtn = document.getElementById('exportByTemplateBtn');
        if (exportByTemplateBtn) {
            exportByTemplateBtn.style.display = 'none';
        }
        
        // 确保显示文件导入区域
        const fileInputSection = document.getElementById('fileInput').closest('.bg-white');
        if (fileInputSection) {
            fileInputSection.style.display = 'block';
        }
        
        console.log('clearAllData 执行完成');
    }

    // 清空所有数据，但不清空文件输入框
    clearAllDataExceptFileInput() {
        this.originalData = null;
        this.originalHeaders = [];
        this.selectedHeaders = [];
        this.filteredData = [];
        this.currentWorkbook = null;
        this.currentFileName = '';
        this.currentRawData = null;
        this.headerRowIndex = 0;

        document.getElementById('fileName').textContent = '未选择文件';
        document.getElementById('clearBtn').style.display = 'none';

        this.hideSections();
        this.hidePreview();
        this.hideWorksheetSelector();
        this.hideHeaderRowSelector();
        
        // 清空分组导出列选项
        const select = document.getElementById('groupExportColumn');
        if (select) {
            while (select.options.length > 1) {
                select.remove(1);
            }
        }
        
        // 隐藏按模板导出按钮
        const exportByTemplateBtn = document.getElementById('exportByTemplateBtn');
        if (exportByTemplateBtn) {
            exportByTemplateBtn.style.display = 'none';
        }
        
        // 确保显示文件导入区域
        const fileInputSection = document.getElementById('fileInput').closest('.bg-white');
        if (fileInputSection) {
            fileInputSection.style.display = 'block';
        }
    }
    // 显示相关区域
    showSections() {
        console.log('showSections 被调用');
        const originalSection = document.getElementById('originalHeadersSection');
        const selectedSection = document.getElementById('selectedHeadersSection');
        const headerRowSelector = document.getElementById('headerRowSelector');
        const worksheetSelector = document.getElementById('worksheetSelector');
        const previewSection = document.getElementById('previewSection');
        const dataFilterSection = document.getElementById('dataFilterSection');
    
        console.log('原始表头区域元素:', originalSection);
        console.log('选中表头区域元素:', selectedSection);
        console.log('表头行选择器区域元素:', headerRowSelector);
        console.log('工作表选择器区域元素:', worksheetSelector);
        console.log('预览区域元素:', previewSection);
        console.log('数据筛选区域元素:', dataFilterSection);
    
        if (originalSection) {
            originalSection.style.display = 'block';
            console.log('显示原始表头区域');
        } else {
            console.log('未找到原始表头区域元素');
        }
    
        if (selectedSection) {
            selectedSection.style.display = 'block';
            console.log('显示选中表头区域');
        } else {
            console.log('未找到选中表头区域元素');
        }
    
        // 同时显示表头行选择器区域
        if (headerRowSelector) {
            headerRowSelector.style.display = 'block';
            console.log('显示表头行选择器区域');
        } else {
            console.log('未找到表头行选择器区域元素');
        }
    
        // 显示工作表选择器区域（仅在处理多工作表Excel文件时需要）
        // 只有在确实需要用户选择工作表时才显示
        if (worksheetSelector && this.currentWorkbook && this.currentWorkbook.SheetNames.length > 1) {
            worksheetSelector.style.display = 'block';
            console.log('显示工作表选择器区域');
        } else if (worksheetSelector) {
            // 隐藏工作表选择器
            worksheetSelector.style.display = 'none';
            console.log('隐藏工作表选择器区域');
        } else {
            console.log('未找到工作表选择器区域元素');
        }
    
        // 显示分组导出区域
        const groupExportSection = document.getElementById('groupExportColumn')?.closest('div');
        if (groupExportSection) {
            groupExportSection.style.display = 'flex';
            console.log('显示分组导出区域');
        } else {
            console.log('未找到分组导出区域元素');
        }
    
        // 确保文件导入区域始终显示
        const fileInputContainer = document.getElementById('fileInput')?.closest('.bg-white');
        if (fileInputContainer) {
            fileInputContainer.style.display = 'block';
            console.log('确保文件导入区域显示');
        } else {
            console.log('未找到文件导入区域元素');
        }
        
        // 添加调试信息，显示所有区域的当前状态
        console.log('显示区域后状态:');
        console.log('原始表头区域显示状态:', originalSection ? originalSection.style.display : '元素未找到');
        console.log('选中表头区域显示状态:', selectedSection ? selectedSection.style.display : '元素未找到');
        console.log('表头行选择器区域显示状态:', headerRowSelector ? headerRowSelector.style.display : '元素未找到');
        console.log('工作表选择器区域显示状态:', worksheetSelector ? worksheetSelector.style.display : '元素未找到');
        console.log('预览区域显示状态:', previewSection ? previewSection.style.display : '元素未找到');
        console.log('数据筛选区域显示状态:', dataFilterSection ? dataFilterSection.style.display : '元素未找到');
    };

    // 隐藏相关区域
    hideSections() {
        console.log('hideSections 被调用');
        const originalSection = document.getElementById('originalHeadersSection');
        const selectedSection = document.getElementById('selectedHeadersSection');
        const headerRowSelector = document.getElementById('headerRowSelector');
        const worksheetSelector = document.getElementById('worksheetSelector');
        
        console.log('原始表头区域元素:', originalSection);
        console.log('选中表头区域元素:', selectedSection);
        
        if (originalSection) {
            originalSection.style.display = 'none';
            console.log('隐藏原始表头区域');
        }
        
        if (selectedSection) {
            selectedSection.style.display = 'none';
            console.log('隐藏选中表头区域');
        }
        
        // 隐藏表头行选择器区域
        if (headerRowSelector) {
            headerRowSelector.style.display = 'none';
            console.log('隐藏表头行选择器区域');
        }
        
        // 隐藏工作表选择器区域
        if (worksheetSelector) {
            worksheetSelector.style.display = 'none';
            console.log('隐藏工作表选择器区域');
        }
        
        this.hidePreview();
        // 隐藏数据筛选区域
        const dataFilterSection = document.getElementById('dataFilterSection');
        if (dataFilterSection) {
            dataFilterSection.style.display = 'none';
        }
    };

    // 显示预览
    showPreview() {
        const previewSection = document.getElementById('previewSection');
        if (previewSection) {
            previewSection.style.display = 'block';
            console.log('显示预览区域');
        }
        
        // 显示按模板导出按钮
        const exportByTemplateBtn = document.getElementById('exportByTemplateBtn');
        if (exportByTemplateBtn) {
            exportByTemplateBtn.style.display = 'inline-block';
        }
    };

    // 隐藏预览
    hidePreview() {
        const previewSection = document.getElementById('previewSection');
        if (previewSection) {
            previewSection.style.display = 'none';
            console.log('隐藏预览区域');
        }
        
        // 隐藏按模板导出按钮
        const exportByTemplateBtn = document.getElementById('exportByTemplateBtn');
        if (exportByTemplateBtn) {
            exportByTemplateBtn.style.display = 'none';
        }
        
        // 不再调用 showSections() 函数
    }

    // 显示工作表选择器
    showWorksheetSelector() {
        const selector = document.getElementById('worksheetSelector');
        const select = document.getElementById('worksheetSelect');
        
        // 清空选项
        select.innerHTML = '';
        
        // 添加工作表选项
        this.currentWorkbook.SheetNames.forEach((sheetName, index) => {
            const option = document.createElement('option');
            option.value = sheetName;
            option.textContent = `${sheetName} (工作表${index + 1})`;
            if (index === 0) option.selected = true; // 默认选中第一个
            select.appendChild(option);
        });
        
        if (selector) {
            selector.style.display = 'block';
            console.log('显示工作表选择器');
        }
        
        // 显示文件导入区域
        const fileInputContainer = document.getElementById('fileInput')?.closest('.bg-white');
        if (fileInputContainer) {
            fileInputContainer.style.display = 'block';
            console.log('确保文件导入区域显示');
        }
    }

    // 显示表头行选择器
    showHeaderRowSelector() {
        const selector = document.getElementById('headerRowSelector');
        const select = document.getElementById('headerRowSelect');
        
        if (!this.currentRawData || this.currentRawData.length === 0) {
            if (selector) {
                selector.style.display = 'none';
            }
            return;
        }
        
        // 清空选项
        select.innerHTML = '';
        
        // 添加行选项（最多显示前10行）
        const maxRows = Math.min(10, this.currentRawData.length);
        for (let i = 0; i < maxRows; i++) {
            const option = document.createElement('option');
            option.value = i;
            // 限制行预览文本长度，避免下拉框过宽
            let rowPreview = this.currentRawData[i] ? 
                this.currentRawData[i].slice(0, 3).map(cell => String(cell || '').trim()).filter(c => c).join(', ') :
                '空行';
            // 如果预览文本过长，进行截断
            if (rowPreview.length > 50) {
                rowPreview = rowPreview.substring(0, 47) + '...';
            }
            option.textContent = `第${i + 1}行: ${rowPreview}`;
            if (i === this.headerRowIndex) option.selected = true;
            select.appendChild(option);
        }
        
        if (selector) {
            selector.style.display = 'block';
            console.log('显示表头行选择器');
        }
        
        // 确保分组导出列下拉框已更新
        setTimeout(() => {
            this.updateGroupExportOptions();
        }, 100);
    };

    // 隐藏表头行选择器
    hideHeaderRowSelector() {
        const selector = document.getElementById('headerRowSelector');
        if (selector) {
            selector.style.display = 'none';
            console.log('隐藏表头行选择器');
        }
        
        // 不再调用 showSections()，避免在清空数据时重新显示区域
    };

    // 解析Excel数据
    parseExcelData(arrayBuffer, fileName) {
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellFormula: true, bookDeps: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
        
        if (jsonData.length === 0) {
            throw new Error('Excel文件为空');
        }
        
        // 保存原始数据格式用于表头选择
        this.currentRawData = jsonData;
        this.headerRowIndex = 0;
        this.currentFileName = fileName;
        
        // 使用第一行作为表头
        const headers = jsonData[0].map(header => String(header || '').trim()).filter(h => h);
        
        // 处理数据行
        const dataRows = [];
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.some(cell => cell !== undefined && cell !== '')) {
                const rowData = {};
                headers.forEach((header, index) => {
                    // 使用智能处理函数处理单元格值
                    let cellValue = this.processCellValue(row[index], header);
                    rowData[header] = String(cellValue !== undefined && cellValue !== null ? cellValue : '').trim();
                });
                dataRows.push(rowData);
            }
        }
        
        return {
            headers: headers,
            data: dataRows,
            fileName: fileName
        };
    }

    // 处理原始数据（根据选中的表头行）
    processRawData() {
        if (!this.currentRawData || this.currentRawData.length === 0) {
            throw new Error('没有数据可处理');
        }
        
        if (this.headerRowIndex >= this.currentRawData.length) {
            throw new Error('表头行索引超出范围');
        }
        
        const headers = this.currentRawData[this.headerRowIndex]
            .map(header => String(header || '').trim())
            .filter(h => h);
        
        if (headers.length === 0) {
            throw new Error(`第${this.headerRowIndex + 1}行没有有效的表头`);
        }
        
        const data = [];
        // 从表头行的下一行开始处理数据
        for (let i = this.headerRowIndex + 1; i < this.currentRawData.length; i++) {
            const row = this.currentRawData[i];
            if (row && row.some(cell => cell !== undefined && cell !== '')) {
                const rowData = {};
                headers.forEach((header, index) => {
                    let cellValue = this.processCellValue(row[index], header);
                    rowData[header] = String(cellValue !== undefined && cellValue !== null ? cellValue : '').trim();
                });
                data.push(rowData);
            }
        }
        
        this.processData(headers, data);
        
        // 如果是在处理多文件流程中选择了工作表，需要继续处理下一个文件
        if (this.pendingFileProcessing) {
            this.pendingFileProcessing.allData.push(data);
            this.pendingFileProcessing.allHeaders.push(headers);
            this.pendingFileProcessing.processedCount++;
            console.log(`文件 ${this.currentFileName} 处理完成 (${this.pendingFileProcessing.processedCount}/${this.pendingFileProcessing.totalFiles})`);
            this.pendingFileProcessing.processNextFile(this.pendingFileProcessing.currentIndex + 1);
            
            // 清理临时数据
            this.pendingFileProcessing = null;
            this.currentWorkbook = null;
        }
    };

    // 处理解析后的数据
    processData(headers, data) {
        this.originalHeaders = headers;
        this.originalData = data;
        this.selectedHeaders = []; // 不自动选择所有表头
        this.filteredData = data; // 初始化筛选数据为原始数据

        this.displayOriginalHeaders();
        this.updateSelectedHeaders(); // 更新选中表头显示（会显示提示信息）
        this.showSections();
        
        // 更新分组导出列选项
        this.updateGroupExportOptions();
        
        // 不在初始化时生成预览，等待用户选择表头后再生成
        // this.generatePreview();
        
        // 显示数据筛选区域
        const filterSection = document.getElementById('dataFilterSection');
        if (filterSection) {
            filterSection.style.display = 'block';
            console.log('显示数据筛选区域');
        }
        
        console.log('解析完成:', {
            headers: headers.length,
            rows: data.length,
            sample: data.slice(0, 3)
        });
        
        // 确保显示相关区域
        this.showSections();
        
        // 显示表头行选择器区域
        const headerRowSelector = document.getElementById('headerRowSelector');
        if (headerRowSelector) {
            headerRowSelector.style.display = 'block';
            console.log('显示表头行选择器区域');
        }
        
        // 确保预览区域显示但不生成预览数据
        this.showPreview();
    }

    // 重新处理当前数据（表头行变化时调用）
    reprocessCurrentData() {
        if (this.currentRawData) {
            try {
                this.processRawData();
            } catch (error) {
                alert('处理数据失败: ' + error.message);
            }
        }
    };

    // 解析选中的工作表
    parseSelectedWorksheet() {
        if (!this.currentWorkbook) {
            alert('没有可解析的工作簿');
            return;
        }
        
        const worksheetSelect = document.getElementById('worksheetSelect');
        const selectedSheetName = worksheetSelect.value;
        
        if (!selectedSheetName) {
            alert('请选择一个工作表');
            return;
        }
        
        try {
            // 解析选中的工作表
            this.parseWorksheet(selectedSheetName);
            
            // 隐藏工作表选择器
            this.hideWorksheetSelector();
        } catch (error) {
            alert('解析工作表失败: ' + error.message);
        }
    }

    // 隐藏工作表选择器
    hideWorksheetSelector() {
        const selector = document.getElementById('worksheetSelector');
        if (selector) {
            selector.style.display = 'none';
            console.log('隐藏工作表选择器');
        }
        // 注意：不要在这里清空 currentWorkbook，因为解析时还需要使用
        // this.currentWorkbook = null;
        
        // 不再显示其他区域，避免在清空数据时重新显示区域
    }

    // 解析指定名称的工作表
    parseWorksheet(sheetName) {
        if (!this.currentWorkbook) {
            throw new Error('没有可解析的工作簿');
        }
        
        const worksheet = this.currentWorkbook.Sheets[sheetName];
        if (!worksheet) {
            throw new Error(`找不到工作表: ${sheetName}`);
        }
        
        // 将工作表转换为原始数据格式（二维数组）
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
        
        if (rawData.length === 0) {
            throw new Error('工作表为空');
        }
        
        this.currentRawData = rawData;
        this.headerRowIndex = 0; // 重置表头行索引
        
        // 显示表头行选择器并处理数据
        this.showHeaderRowSelector();
        this.processRawData();
        
        // 确保显示相关区域
        this.showSections();
    }

    // 隐藏表头行选择器
    hideHeaderRowSelector() {
        const selector = document.getElementById('headerRowSelector');
        if (selector) {
            selector.style.display = 'none';
            console.log('隐藏表头行选择器');
        }
        
        // 不再调用 showSections()，避免在清空数据时重新显示区域
    }

    // 隐藏工作表选择器
    hideWorksheetSelector() {
        const selector = document.getElementById('worksheetSelector');
        if (selector) {
            selector.style.display = 'none';
            console.log('隐藏工作表选择器');
        }
        // 注意：不要在这里清空 currentWorkbook，因为解析时还需要使用
        // this.currentWorkbook = null;
        
        // 不再显示其他区域，避免在清空数据时重新显示区域
    }

    // 取消工作表选择
    cancelWorksheetSelection() {
        // 隐藏工作表选择器
        this.hideWorksheetSelector();
        
        // 清理临时数据
        this.currentWorkbook = null;
        this.currentFileName = '';
        this.currentRawData = null;
        
        // 显示文件导入区域
        const fileInputContainer = document.getElementById('fileInput').closest('.bg-white');
        if (fileInputContainer) {
            fileInputContainer.style.display = 'block';
        }
    }

    // 清空选择
    clearSelectedHeaders() {
        this.selectedHeaders = [];
        this.updateSelectedHeaders();
        this.filteredData = this.originalData;
        this.hidePreview();
    }

    // 全选表头
    selectAllHeaders() {
        // 清空当前已选择的表头
        this.selectedHeaders = [];
        
        // 按原始顺序添加所有表头
        this.originalHeaders.forEach(header => {
            this.selectedHeaders.push(header);
        });
        
        // 更新显示
        this.updateSelectedHeaders();
        
        // 显示数据筛选区域
        const filterSection = document.getElementById('dataFilterSection');
        if (filterSection) {
            filterSection.style.display = 'block';
            // 重新初始化筛选条件
            this.initFilterConditions();
        }
    }

    // 从选中列表中移除表头
    removeFromSelected(headerText) {
        const index = this.selectedHeaders.indexOf(headerText);
        if (index > -1) {
            this.selectedHeaders.splice(index, 1);
            this.updateSelectedHeaders();
            
            // 如果没有选中的表头了，隐藏筛选区域
            if (this.selectedHeaders.length === 0) {
                const filterSection = document.getElementById('dataFilterSection');
                if (filterSection) {
                    filterSection.style.display = 'none';
                }
            }
        }
    }
    
    // 获取拖拽元素应该放置的位置
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.header-chip:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    // 修改 exportByTemplate 函数以使用保存的模板名
    // 设置拖拽排序功能
    setupSortable(container) {
        // 为选中的表头添加拖拽排序功能
        const chips = container.querySelectorAll('.header-chip');
        chips.forEach(chip => {
            chip.draggable = true;
            
            chip.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', chip.textContent);
                chip.classList.add('dragging');
            });
            
            chip.addEventListener('dragend', () => {
                chip.classList.remove('dragging');
            });
        });
        
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('drag-over');
            
            const draggingChip = document.querySelector('.header-chip.dragging');
            if (draggingChip) {
                const afterElement = this.getDragAfterElement(container, e.clientY);
                if (afterElement && afterElement !== draggingChip) {
                    container.insertBefore(draggingChip, afterElement);
                } else if (!afterElement) {
                    container.appendChild(draggingChip);
                }
            }
        });
        
        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });
        
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            
            // 更新selectedHeaders数组以匹配新的顺序
            const newOrder = [];
            const chips = container.querySelectorAll('.header-chip');
            chips.forEach(chip => {
                const headerText = chip.textContent.replace('×', '').trim();
                if (this.selectedHeaders.includes(headerText)) {
                    newOrder.push(headerText);
                }
            });
            
            this.selectedHeaders = newOrder;
        });
    }
    
    // 生成预览
    generatePreview() {
        // 检查是否有选中的表头
        if (this.selectedHeaders.length === 0) {
            this.showSelectHeaderMessage();
            return;
        }

        // 如果还没有筛选数据，则使用原始数据
        let dataToDisplay = this.filteredData;
        if (!this.filteredData || this.filteredData.length === 0) {
            dataToDisplay = this.originalData;
        }

        this.displayPreviewWithHeaders(this.selectedHeaders, dataToDisplay);
    }

    // 显示预览但不检查选中的表头
    showPreviewWithoutCheck() {
        // 如果还没有筛选数据，则使用原始数据
        let dataToDisplay = this.filteredData;
        if (!this.filteredData || this.filteredData.length === 0) {
            dataToDisplay = this.originalData;
        }

        // 如果没有选中的表头，显示提示信息
        if (this.selectedHeaders.length === 0) {
            this.showSelectHeaderMessage();
            return;
        }
        
        // 如果有选中的表头，则使用选中的表头进行预览
        this.displayPreviewWithHeaders(this.selectedHeaders, dataToDisplay);
    }

    // 显示预览表格
    displayPreview() {
        // 检查是否有选中的表头
        if (this.selectedHeaders.length === 0) {
            this.showSelectHeaderMessage();
            return;
        }
        
        const table = document.getElementById('previewTable');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        // 清理表头名称，移除可能的特殊字符
        const cleanHeaders = this.selectedHeaders.map(header => 
            String(header).replace(/[×*+]/g, '').trim()
        );

        // 生成表头
        thead.innerHTML = `
            <tr>
                ${cleanHeaders.map(header => 
                    `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${header}</th>`
                ).join('')}
            </tr>
        `;

        // 生成数据行（显示前50行）
        const displayData = this.filteredData.slice(0, 50);
        tbody.innerHTML = displayData.map(row => `
            <tr class="hover:bg-gray-50">
                ${this.selectedHeaders.map(header => 
                    `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${this.escapeHtml(row[header])}</td>`
                ).join('')}
            </tr>
        `).join('');

        // 更新统计信息
        const statsDiv = document.getElementById('dataStats');
        statsDiv.innerHTML = `
            <div class="flex justify-between items-center">
                <span>共 ${this.filteredData.length} 行数据，显示前 ${Math.min(50, this.filteredData.length)} 行</span>
                <span>已选择 ${this.selectedHeaders.length} 列</span>
            </div>
        `;

        this.showPreview();
    }

    // 显示预览表格但不检查选中的表头
    displayPreviewWithoutCheck() {
        const table = document.getElementById('previewTable');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        // 如果没有选中的表头，则使用所有表头进行预览
        const headersToDisplay = this.selectedHeaders.length > 0 ? this.selectedHeaders : this.originalHeaders;

        // 清理表头名称，移除可能的特殊字符
        const cleanHeaders = headersToDisplay.map(header => 
            String(header).replace(/[×*+]/g, '').trim()
        );

        // 生成表头
        thead.innerHTML = `
            <tr>
                ${cleanHeaders.map(header => 
                    `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${header}</th>`
                ).join('')}
            </tr>
        `;

        // 生成数据行（显示前50行）
        const displayData = this.filteredData.slice(0, 50);
        tbody.innerHTML = displayData.map(row => `
            <tr class="hover:bg-gray-50">
                ${cleanHeaders.map(header => 
                    `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${this.escapeHtml(row[header])}</td>`
                ).join('')}
            </tr>
        `).join('');

        // 更新统计信息
        const statsDiv = document.getElementById('dataStats');
        statsDiv.innerHTML = `
            <div class="flex justify-between items-center">
                <span>共 ${this.filteredData.length} 行数据，显示前 ${Math.min(50, this.filteredData.length)} 行</span>
                <span>已选择 ${this.selectedHeaders.length} 列</span>
            </div>
        `;

        this.showPreview();
    }

    // 显示选择表头的提示消息
    showSelectHeaderMessage() {
        // 不再显示alert提示，而是显示一个友好的提示信息
        const table = document.getElementById('previewTable');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        // 清空表格内容
        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = '<tr><td colspan="100" class="text-center py-8 text-gray-500">请先选择要显示的表头</td></tr>';

        // 更新统计信息
        const statsDiv = document.getElementById('dataStats');
        if (statsDiv) {
            statsDiv.innerHTML = `
                <div class="flex justify-between items-center">
                    <span>共 ${this.filteredData.length || 0} 行数据</span>
                    <span>已选择 0 列</span>
                </div>
            `;
        }

        this.showPreview();
    }

    // 显示预览表格但不检查选中的表头
    displayPreviewWithoutCheck() {
        // 如果没有选中的表头，显示提示信息
        if (this.selectedHeaders.length === 0) {
            this.showSelectHeaderMessage();
            return;
        }
        
        const table = document.getElementById('previewTable');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        // 清理表头名称，移除可能的特殊字符
        const cleanHeaders = this.selectedHeaders.map(header => 
            String(header).replace(/[×*+]/g, '').trim()
        );

        // 生成表头
        thead.innerHTML = `
            <tr>
                ${cleanHeaders.map(header => 
                    `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${header}</th>`
                ).join('')}
            </tr>
        `;

        // 生成数据行（显示前50行）
        const displayData = this.filteredData.slice(0, 50);
        tbody.innerHTML = displayData.map(row => `
            <tr class="hover:bg-gray-50">
                ${cleanHeaders.map(header => 
                    `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${this.escapeHtml(row[header])}</td>`
                ).join('')}
            </tr>
        `).join('');

        // 更新统计信息
        const statsDiv = document.getElementById('dataStats');
        statsDiv.innerHTML = `
            <div class="flex justify-between items-center">
                <span>共 ${this.filteredData.length} 行数据，显示前 ${Math.min(50, this.filteredData.length)} 行</span>
                <span>已选择 ${this.selectedHeaders.length} 列</span>
            </div>
        `;

        this.showPreview();
    }

    // HTML转义
    escapeHtml(text) {
        // 处理0值等特殊情况，确保它们能正确显示
        if (text === 0 || text === '0') {
            console.log('escapeHtml: 处理0值，返回"0"');
            return '0';
        }
        const div = document.createElement('div');
        div.textContent = text;
        const result = div.innerHTML;
        console.log('escapeHtml: 输入:', text, '输出:', result);
        return result;
    }

    // 显示成功消息
    showSuccessMessage(message) {
        // 创建提示框
        const alert = document.createElement('div');
        alert.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        alert.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">✓</span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(alert);
        
        // 3秒后自动消失
        setTimeout(() => {
            if (alert.parentNode) {
                document.body.removeChild(alert);
            }
        }, 3000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new DataFilterPage();
});