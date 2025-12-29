// 修复Excel数据导入时的列错位问题
// 主要修复内容：
// 1. 防止将客户编号等数值错误识别为Excel日期序列号
// 2. 确保只有在明确的日期列中才进行日期转换
// 3. 修复包含跨工作表引用的Excel文件数据列偏移问题

class DataFilterFix {
    // 判断是否为Excel日期序列号（更严格的判断）
    static isExcelDateSerial(value, headerName) {
        // 只有在明确的日期列中才进行日期序列号判断
        if (!this.shouldProcessAsDate(headerName)) {
            return false;
        }
        
        // 检查是否为数字且在合理的日期序列号范围内
        if (typeof value !== 'number') return false;
        
        // Excel日期序列号通常在1-100000之间
        if (value < 1 || value > 100000) return false;
        
        // 更严格的检查：只识别可能的日期范围（大约1950-2050年）
        if (value < 18264 || value > 54789) return false;
        
        // 进一步检查：尝试转换为日期并验证
        try {
            const convertedDate = DateHelper.convertExcelDate(value);
            const dateParts = convertedDate.split('-');
            if (dateParts.length === 3) {
                const year = parseInt(dateParts[0]);
                if (year >= 1950 && year <= 2050) {
                    return true;
                }
            }
        } catch (e) {
            return false;
        }
        
        return false;
    }

    // 根据表头名称判断是否应优先处理为日期
    static shouldProcessAsDate(headerName) {
        const dateKeywords = ['年月', '日期', '时间'];
        return dateKeywords.some(keyword => headerName.includes(keyword));
    }

    // 根据表头名称判断是否应优先处理为数字
    static shouldProcessAsNumber(headerName) {
        const numberKeywords = ['单价', '总价', '金额', '数量', '价', '额', '编号', '客户编号'];
        return numberKeywords.some(keyword => headerName.includes(keyword));
    }

    // 智能处理单元格值（修复版本）
    static processCellValue(cellValue, headerName) {
        // 如果是Date对象，直接格式化
        if (cellValue instanceof Date) {
            try {
                const utcDate = new Date(Date.UTC(cellValue.getFullYear(), cellValue.getMonth(), cellValue.getDate()));
                return DateHelper.formatDate(utcDate);
            } catch (e) {
                console.warn('Date对象格式化失败:', cellValue, e);
            }
        }
        
        // 对于空值，直接返回空字符串
        if (cellValue === undefined || cellValue === null) {
            return '';
        }
        
        // 对于明确的数字列（如客户编号、数量等），不进行任何转换
        if (this.shouldProcessAsNumber(headerName)) {
            return cellValue;
        }
        
        // 对于日期列，检查是否为Excel日期序列号
        if (this.shouldProcessAsDate(headerName)) {
            if (this.isExcelDateSerial(cellValue, headerName)) {
                return DateHelper.convertExcelDate(cellValue);
            }
        }
        
        // 对于其他列，只有在表头明确包含日期相关关键词时才进行转换
        const lowerHeader = headerName.toLowerCase();
        if (lowerHeader.includes('日期') || lowerHeader.includes('时间') || lowerHeader.includes('年月')) {
            if (this.isExcelDateSerial(cellValue, headerName)) {
                return DateHelper.convertExcelDate(cellValue);
            }
        }
        
        // 默认情况，直接返回原值
        return cellValue;
    }
    
    // 修复包含跨工作表引用的Excel文件数据列偏移问题
    static fixExcelDataWithExternalReferences(rawData) {
        // 检查数据是否可能存在列偏移问题
        if (!rawData || rawData.length === 0) {
            return rawData;
        }
        
        // 检查第一行是否以空值开始，且后续列有数据
        const firstRow = rawData[0];
        if (firstRow && firstRow.length > 1 && (firstRow[0] === undefined || firstRow[0] === null || firstRow[0] === '')) {
            // 检查是否存在明显的列偏移（第一列为空，后续列有数据）
            let hasDataInLaterColumns = false;
            for (let i = 1; i < Math.min(firstRow.length, 5); i++) {
                if (firstRow[i] !== undefined && firstRow[i] !== null && firstRow[i] !== '') {
                    hasDataInLaterColumns = true;
                    break;
                }
            }
            
            // 如果第一列为空且后续列有数据，可能是列偏移
            if (hasDataInLaterColumns) {
                console.log('检测到可能的列偏移问题，尝试修复...');
                
                // 修复数据：移除每行的第一个空列
                const fixedData = rawData.map(row => {
                    if (row && row.length > 1) {
                        // 移除第一个元素
                        return row.slice(1);
                    }
                    return row;
                });
                
                console.log('列偏移修复完成');
                return fixedData;
            }
        }
        
        // 没有检测到明显的列偏移问题，返回原始数据
        return rawData;
    }
}

// 导出修复类
window.DataFilterFix = DataFilterFix;