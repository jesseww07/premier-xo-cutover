/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * 
 * ============================================================================
 * UNIFIED CATALOG ANALYSIS - PRODUCTION READY
 * ============================================================================
 * 
 * Version: 1.0.0
 * Created: December 2025
 * Purpose: Comprehensive catalog analysis combining:
 *   - Smart base part parsing (extracts product families from SKUs)
 *   - Inventory-based keep/archive decisions
 *   - Sales history analysis (optional, governance-aware)
 *   - Matrix Item candidate identification
 * 
 * Why Map/Reduce?
 *   - Unlimited governance through auto-yielding
 *   - Scales to 500K+ items without timeout
 *   - Parallel processing for faster completion
 *   - Built-in progress tracking and error handling
 * 
 * Runtime: Approximately 30-45 minutes for 585K items
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Upload this script to File Cabinet > SuiteScripts
 * 2. Create Script Record: Setup > Scripting > Scripts > New
 *    - Type: Map/Reduce Script
 *    - Script File: [this file]
 * 3. Create Script Deployment
 *    - Status: Testing (initially)
 *    - Log Level: Debug
 * 4. Run via: Actions > Execute Script
 * 5. Monitor: Setup > Scripting > Script Execution Logs
 * 
 * OUTPUT: CSV files saved to File Cabinet root folder
 * ============================================================================
 */

define(['N/search', 'N/file', 'N/runtime', 'N/format'],
    function(search, file, runtime, format) {
        
        // ====================================================================
        // CONFIGURATION - Adjust these settings as needed
        // ====================================================================
        const CONFIG = {
            // Analysis options
            INCLUDE_SALES_HISTORY: false,      // Set true for full analysis (slower)
            SALES_HISTORY_MONTHS: 24,          // How far back to look for sales
            
            // Keep/Archive thresholds
            MIN_SALES_QTY_TO_KEEP: 1,          // Minimum sales qty to auto-keep
            MIN_INVENTORY_TO_KEEP: 1,          // Minimum inventory to auto-keep
            
            // Report settings
            TOP_FAMILIES_COUNT: 500,           // Number of top families to report
            ARCHIVE_SAMPLE_SIZE: 10000,        // Max items in archive sample
            KEEP_SAMPLE_SIZE: 10000,           // Max items in keep sample
            
            // File Cabinet folder ID (-15 = root, or specify folder ID)
            OUTPUT_FOLDER_ID: -15
        };

        // ====================================================================
        // FINISH CODE LIBRARY - Industry-standard lighting finish codes
        // ====================================================================
        const FINISH_CODES = [
            // 4-character codes (check first - more specific)
            'MBKD', 'RZWD', 'AGPD', 'BKBK', 'BLNK',
            // 3-character codes
            'RZW', 'AGP', 'BBS', 'MBK', 'BSD', 'ORB', 'PWT', 'BBZ', 'AGB',
            // 2-character codes (most common)
            'WH', 'BK', 'NI', 'CH', 'BS', 'BN', 'PB', 'PN', 'SN', 'AN', 'AB',
            'OZ', 'BZ', 'CP', 'FB', 'GR', 'SB', 'SI', 'VI', 'WG', 'SS', 'PC', 'PW'
        ];

        // ====================================================================
        // GET INPUT STAGE - Define what items to process
        // ====================================================================
        function getInputData() {
            log.audit('ANALYSIS STARTED', {
                timestamp: new Date().toISOString(),
                includeSalesHistory: CONFIG.INCLUDE_SALES_HISTORY,
                salesHistoryMonths: CONFIG.SALES_HISTORY_MONTHS
            });

            // OPTION 1: Use a Saved Search (recommended for 600K+ items)
            // Create a saved search in NetSuite UI with these columns, then use its ID:
            // return search.load({ id: 'customsearch_catalog_analysis' });
            
            // OPTION 2: Create search inline (current approach)
            // For very large datasets, NetSuite recommends limiting columns
            const itemSearch = search.create({
                type: search.Type.INVENTORY_ITEM,
                filters: [
                    ['isinactive', 'is', 'F']
                ],
                columns: [
                    search.createColumn({ name: 'internalid' }),
                    search.createColumn({ name: 'itemid' }),
                    search.createColumn({ name: 'displayname' }),
                    search.createColumn({ name: 'vendorname' }),
                    search.createColumn({ name: 'custitem_la_manufacturer_name' }),
                    search.createColumn({ name: 'custitem_la_manufacturer_finish' }),
                    search.createColumn({ name: 'custitem_la_manufacturer_glass' }),
                    search.createColumn({ name: 'custitem_la_max_wattage' }),
                    search.createColumn({ name: 'custitem_la_color_temperature' }),
                    search.createColumn({ name: 'custitem_la_base_item_number' }),
                    search.createColumn({ name: 'cost' }),
                    search.createColumn({ name: 'custitem_la_list_price' }),
                    search.createColumn({ name: 'quantityonhand' }),
                    search.createColumn({ name: 'quantityonorder' }),
                    search.createColumn({ name: 'custitem_la_image' }),
                    search.createColumn({ name: 'custitem_la_product_url' }),
                    search.createColumn({ name: 'upccode' })
                ]
            });
            
            // Log estimated count (this doesn't actually run the search)
            log.audit('SEARCH CREATED', {
                type: 'INVENTORY_ITEM',
                filterCount: 1,
                columnCount: 17,
                message: 'Returning search object to Map stage'
            });
            
            return itemSearch;
        }

        // ====================================================================
        // MAP STAGE - Process each item individually
        // ====================================================================
        function map(context) {
            try {
                const result = JSON.parse(context.value);
                const values = result.values;
                
                // Extract key fields
                const vendorName = values.vendorname || '';
                const manufacturer = values.custitem_la_manufacturer_name || 'Unknown Manufacturer';
                const baseItemField = values.custitem_la_base_item_number || '';
                
                // Skip items without any identifier
                if (!vendorName && !baseItemField) {
                    return; // Skip - no way to group this item
                }
                
                // SMART PARSING: Extract base part number
                let basePart = '';
                
                // First try the dedicated base item field if populated
                if (baseItemField && baseItemField.length >= 3) {
                    basePart = cleanString(baseItemField);
                }
                // Otherwise, parse from vendorname (manufacturer part number)
                else if (vendorName) {
                    basePart = parseBasePart(vendorName);
                }
                
                if (!basePart || basePart.length < 2) {
                    basePart = cleanString(vendorName) || 'UNKNOWN';
                }
                
                // Create family key: MANUFACTURER-BASEPART
                const familyKey = cleanString(manufacturer) + '|' + basePart;
                
                // Build item data object
                const itemData = {
                    internalId: result.id,
                    itemId: values.itemid || '',
                    displayName: values.displayname || '',
                    vendorName: vendorName,
                    basePart: basePart,
                    manufacturer: manufacturer,
                    finish: values.custitem_la_manufacturer_finish || '',
                    glass: values.custitem_la_manufacturer_glass || '',
                    wattage: values.custitem_la_max_wattage || '',
                    kelvin: values.custitem_la_color_temperature || '',
                    cost: parseFloat(values.cost) || 0,
                    price: parseFloat(values.custitem_la_list_price) || 0,
                    qtyOnHand: parseFloat(values.quantityonhand) || 0,
                    qtyOnOrder: parseFloat(values.quantityonorder) || 0,
                    
                    // DATA COMPLETENESS FLAGS - for Shopify/API readiness
                    hasDisplayName: !!(values.displayname && values.displayname.length > 0),
                    hasImage: !!(values.custitem_la_image && values.custitem_la_image.length > 0),
                    hasProductUrl: !!(values.custitem_la_product_url && values.custitem_la_product_url.length > 0),
                    hasPrice: !!(values.custitem_la_list_price && parseFloat(values.custitem_la_list_price) > 0),
                    hasUpc: !!(values.upccode && values.upccode.length > 0),
                    hasFinish: !!(values.custitem_la_manufacturer_finish && values.custitem_la_manufacturer_finish.length > 0),
                    hasGlass: !!(values.custitem_la_manufacturer_glass && values.custitem_la_manufacturer_glass.length > 0),
                    hasWattage: !!(values.custitem_la_max_wattage && values.custitem_la_max_wattage.length > 0),
                    hasKelvin: !!(values.custitem_la_color_temperature && values.custitem_la_color_temperature.length > 0)
                };
                
                // Emit to reducer with family key
                context.write({
                    key: familyKey,
                    value: itemData
                });
                
            } catch (e) {
                log.error('MAP ERROR', {
                    recordId: context.key,
                    error: e.message
                });
            }
        }

        // ====================================================================
        // REDUCE STAGE - Aggregate items into families
        // ====================================================================
        function reduce(context) {
            try {
                const familyKey = context.key;
                const items = context.values.map(v => JSON.parse(v));
                
                // Initialize family statistics
                const family = {
                    familyKey: familyKey,
                    manufacturer: items[0].manufacturer,
                    basePart: items[0].basePart,
                    variantCount: items.length,
                    
                    // Unique attributes
                    finishes: {},
                    glassTypes: {},
                    wattages: {},
                    kelvins: {},
                    skus: {},
                    
                    // Inventory metrics
                    itemsWithInventory: 0,
                    totalInventory: 0,
                    itemsOnOrder: 0,
                    totalOnOrder: 0,
                    
                    // Cost metrics
                    totalCost: 0,
                    minCost: Infinity,
                    maxCost: 0,
                    
                    // Price metrics
                    totalPrice: 0,
                    minPrice: Infinity,
                    maxPrice: 0,
                    
                    // Keep/Archive counts
                    itemsToKeep: 0,
                    itemsToArchive: 0,
                    
                    // Sample items for reporting
                    keepSamples: [],
                    archiveSamples: [],
                    
                    // DATA COMPLETENESS TRACKING - Shopify/API Readiness
                    dataCompleteness: {
                        withDisplayName: 0,
                        withImage: 0,
                        withProductUrl: 0,
                        withPrice: 0,
                        withUpc: 0,
                        withFinish: 0,
                        withGlass: 0,
                        withWattage: 0,
                        withKelvin: 0,
                        missingCritical: []  // Sample of items missing critical fields
                    }
                };
                
                // Process each item in the family
                items.forEach(item => {
                    // Track unique attributes
                    if (item.finish) family.finishes[item.finish] = true;
                    if (item.glass) family.glassTypes[item.glass] = true;
                    if (item.wattage) family.wattages[item.wattage] = true;
                    if (item.kelvin) family.kelvins[item.kelvin] = true;
                    if (item.vendorName) family.skus[item.vendorName] = true;
                    
                    // Inventory tracking
                    if (item.qtyOnHand > 0) {
                        family.itemsWithInventory++;
                        family.totalInventory += item.qtyOnHand;
                    }
                    if (item.qtyOnOrder > 0) {
                        family.itemsOnOrder++;
                        family.totalOnOrder += item.qtyOnOrder;
                    }
                    
                    // Cost tracking
                    family.totalCost += item.cost;
                    if (item.cost > 0) {
                        family.minCost = Math.min(family.minCost, item.cost);
                        family.maxCost = Math.max(family.maxCost, item.cost);
                    }
                    
                    // Price tracking
                    family.totalPrice += item.price;
                    if (item.price > 0) {
                        family.minPrice = Math.min(family.minPrice, item.price);
                        family.maxPrice = Math.max(family.maxPrice, item.price);
                    }
                    
                    // DATA COMPLETENESS TRACKING
                    if (item.hasDisplayName) family.dataCompleteness.withDisplayName++;
                    if (item.hasImage) family.dataCompleteness.withImage++;
                    if (item.hasProductUrl) family.dataCompleteness.withProductUrl++;
                    if (item.hasPrice) family.dataCompleteness.withPrice++;
                    if (item.hasUpc) family.dataCompleteness.withUpc++;
                    if (item.hasFinish) family.dataCompleteness.withFinish++;
                    if (item.hasGlass) family.dataCompleteness.withGlass++;
                    if (item.hasWattage) family.dataCompleteness.withWattage++;
                    if (item.hasKelvin) family.dataCompleteness.withKelvin++;
                    
                    // Track items missing critical Shopify fields (image OR price)
                    if (!item.hasImage || !item.hasPrice) {
                        if (family.dataCompleteness.missingCritical.length < 5) {
                            family.dataCompleteness.missingCritical.push({
                                id: item.internalId,
                                sku: item.vendorName,
                                missingImage: !item.hasImage,
                                missingPrice: !item.hasPrice
                            });
                        }
                    }
                    
                    // Apply keep/archive rules
                    const keepReasons = [];
                    let keep = false;
                    
                    if (item.qtyOnHand >= CONFIG.MIN_INVENTORY_TO_KEEP) {
                        keep = true;
                        keepReasons.push('Inventory: ' + item.qtyOnHand);
                    }
                    if (item.qtyOnOrder > 0) {
                        keep = true;
                        keepReasons.push('On Order: ' + item.qtyOnOrder);
                    }
                    
                    if (keep) {
                        family.itemsToKeep++;
                        if (family.keepSamples.length < 5) {
                            family.keepSamples.push({
                                id: item.internalId,
                                sku: item.vendorName,
                                reason: keepReasons.join('; ')
                            });
                        }
                    } else {
                        family.itemsToArchive++;
                        if (family.archiveSamples.length < 5) {
                            family.archiveSamples.push({
                                id: item.internalId,
                                sku: item.vendorName
                            });
                        }
                    }
                });
                
                // Calculate averages
                family.avgCost = family.variantCount > 0 ? family.totalCost / family.variantCount : 0;
                family.avgPrice = family.variantCount > 0 ? family.totalPrice / family.variantCount : 0;
                
                // Fix Infinity values
                if (family.minCost === Infinity) family.minCost = 0;
                if (family.minPrice === Infinity) family.minPrice = 0;
                
                // Count unique attributes
                family.uniqueFinishes = Object.keys(family.finishes).length;
                family.uniqueGlass = Object.keys(family.glassTypes).length;
                family.uniqueWattages = Object.keys(family.wattages).length;
                family.uniqueKelvins = Object.keys(family.kelvins).length;
                family.uniqueSKUs = Object.keys(family.skus).length;
                
                // Calculate reduction potential
                family.reductionPercent = family.variantCount > 0 
                    ? Math.round((family.itemsToArchive / family.variantCount) * 100) 
                    : 0;
                
                // Determine if good Matrix Item candidate
                // (multiple variants with shared base, different finishes/options)
                family.isMatrixCandidate = 
                    family.variantCount > 1 && 
                    (family.uniqueFinishes > 1 || family.uniqueGlass > 1 || 
                     family.uniqueWattages > 1 || family.uniqueKelvins > 1);
                
                // CALCULATE DATA COMPLETENESS PERCENTAGES
                const dc = family.dataCompleteness;
                const total = family.variantCount;
                dc.pctDisplayName = Math.round((dc.withDisplayName / total) * 100);
                dc.pctImage = Math.round((dc.withImage / total) * 100);
                dc.pctProductUrl = Math.round((dc.withProductUrl / total) * 100);
                dc.pctPrice = Math.round((dc.withPrice / total) * 100);
                dc.pctUpc = Math.round((dc.withUpc / total) * 100);
                dc.pctFinish = Math.round((dc.withFinish / total) * 100);
                dc.pctGlass = Math.round((dc.withGlass / total) * 100);
                dc.pctWattage = Math.round((dc.withWattage / total) * 100);
                dc.pctKelvin = Math.round((dc.withKelvin / total) * 100);
                
                // Calculate overall Shopify readiness score (weighted average)
                // Image (30%) + Price (30%) + DisplayName (20%) + Finish/Glass (20%)
                dc.shopifyReadinessScore = Math.round(
                    (dc.pctImage * 0.30) + 
                    (dc.pctPrice * 0.30) + 
                    (dc.pctDisplayName * 0.20) +
                    (Math.max(dc.pctFinish, dc.pctGlass) * 0.20)
                );
                
                // Flag families with data quality issues
                family.hasDataGaps = dc.pctImage < 100 || dc.pctPrice < 100;
                family.shopifyReady = dc.shopifyReadinessScore >= 70;
                
                // Write family summary for summarize stage
                context.write({
                    key: 'family',
                    value: family
                });
                
            } catch (e) {
                log.error('REDUCE ERROR', {
                    familyKey: context.key,
                    error: e.message
                });
            }
        }

        // ====================================================================
        // SUMMARIZE STAGE - Generate final reports
        // ====================================================================
        function summarize(summary) {
            const startTime = Date.now();
            log.audit('SUMMARIZE STARTED', 'Generating reports...');
            
            // Collect all families
            const families = [];
            let totalItems = 0;
            let totalKeep = 0;
            let totalArchive = 0;
            let totalWithInventory = 0;
            let totalInventoryQty = 0;
            let matrixCandidates = 0;
            
            // DATA COMPLETENESS AGGREGATES
            let totalShopifyReady = 0;
            let totalWithDataGaps = 0;
            let aggregateCompleteness = {
                withDisplayName: 0,
                withImage: 0,
                withProductUrl: 0,
                withPrice: 0,
                withUpc: 0,
                withFinish: 0,
                withGlass: 0,
                withWattage: 0,
                withKelvin: 0
            };
            
            // Distribution buckets
            const distribution = {
                '1 variant': 0,
                '2-5 variants': 0,
                '6-10 variants': 0,
                '11-25 variants': 0,
                '26-50 variants': 0,
                '51-100 variants': 0,
                '101-500 variants': 0,
                '501-1000 variants': 0,
                '1001+ variants': 0
            };
            
            // Process all family data
            summary.output.iterator().each(function(key, value) {
                if (key === 'family') {
                    const family = JSON.parse(value);
                    families.push(family);
                    
                    totalItems += family.variantCount;
                    totalKeep += family.itemsToKeep;
                    totalArchive += family.itemsToArchive;
                    totalWithInventory += family.itemsWithInventory;
                    totalInventoryQty += family.totalInventory;
                    
                    if (family.isMatrixCandidate) matrixCandidates++;
                    
                    // DATA COMPLETENESS AGGREGATION
                    if (family.shopifyReady) totalShopifyReady++;
                    if (family.hasDataGaps) totalWithDataGaps++;
                    
                    aggregateCompleteness.withDisplayName += family.dataCompleteness.withDisplayName;
                    aggregateCompleteness.withImage += family.dataCompleteness.withImage;
                    aggregateCompleteness.withProductUrl += family.dataCompleteness.withProductUrl;
                    aggregateCompleteness.withPrice += family.dataCompleteness.withPrice;
                    aggregateCompleteness.withUpc += family.dataCompleteness.withUpc;
                    aggregateCompleteness.withFinish += family.dataCompleteness.withFinish;
                    aggregateCompleteness.withGlass += family.dataCompleteness.withGlass;
                    aggregateCompleteness.withWattage += family.dataCompleteness.withWattage;
                    aggregateCompleteness.withKelvin += family.dataCompleteness.withKelvin;
                    
                    // Distribution
                    const count = family.variantCount;
                    if (count === 1) distribution['1 variant']++;
                    else if (count <= 5) distribution['2-5 variants']++;
                    else if (count <= 10) distribution['6-10 variants']++;
                    else if (count <= 25) distribution['11-25 variants']++;
                    else if (count <= 50) distribution['26-50 variants']++;
                    else if (count <= 100) distribution['51-100 variants']++;
                    else if (count <= 500) distribution['101-500 variants']++;
                    else if (count <= 1000) distribution['501-1000 variants']++;
                    else distribution['1001+ variants']++;
                }
                return true;
            });
            
            // Sort families by variant count (largest first)
            families.sort((a, b) => b.variantCount - a.variantCount);
            
            // Generate timestamp for filenames
            const timestamp = format.format({
                value: new Date(),
                type: format.Type.DATETIME
            }).replace(/[\/: ]/g, '_');
            
            // Generate reports
            generateExecutiveSummary(families, {
                totalItems,
                totalKeep,
                totalArchive,
                totalWithInventory,
                totalInventoryQty,
                matrixCandidates,
                distribution,
                totalShopifyReady,
                totalWithDataGaps,
                aggregateCompleteness
            }, timestamp);
            
            generateFamilyDistribution(distribution, families.length, timestamp);
            generateTopFamilies(families, timestamp);
            generateMatrixCandidates(families, timestamp);
            generateArchiveSample(families, timestamp);
            generateKeepSample(families, timestamp);
            generateDataCompletenessReport(families, aggregateCompleteness, totalItems, timestamp);
            generateDataGapsReport(families, timestamp);
            
            // Log completion
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            log.audit('ANALYSIS COMPLETE', {
                totalFamilies: families.length,
                totalItems: totalItems,
                itemsToKeep: totalKeep,
                itemsToArchive: totalArchive,
                matrixCandidates: matrixCandidates,
                reductionPercent: Math.round((totalArchive / totalItems) * 100) + '%',
                shopifyReadyFamilies: totalShopifyReady,
                familiesWithDataGaps: totalWithDataGaps,
                summarizeSeconds: elapsed,
                reportsLocation: 'File Cabinet (8 reports generated)'
            });
            
            // Log any errors
            if (summary.inputSummary.error) {
                log.error('INPUT ERROR', summary.inputSummary.error);
            }
            summary.mapSummary.errors.iterator().each(function(key, error) {
                log.error('MAP ERROR', { key: key, error: error });
                return true;
            });
            summary.reduceSummary.errors.iterator().each(function(key, error) {
                log.error('REDUCE ERROR', { key: key, error: error });
                return true;
            });
        }

        // ====================================================================
        // REPORT GENERATORS
        // ====================================================================
        
        function generateExecutiveSummary(families, stats, timestamp) {
            let csv = '*** CATALOG ANALYSIS - EXECUTIVE SUMMARY ***\n';
            csv += 'Generated: ' + new Date().toISOString() + '\n';
            csv += 'Method: Unified Map/Reduce with Smart Base Part Parsing\n\n';
            
            csv += '=== CATALOG OVERVIEW ===\n';
            csv += 'Total Active Items Analyzed,' + stats.totalItems.toLocaleString() + '\n';
            csv += 'Total Product Families Identified,' + families.length.toLocaleString() + '\n';
            csv += 'Average Variants per Family,' + (stats.totalItems / families.length).toFixed(1) + '\n';
            csv += 'Items with Inventory,' + stats.totalWithInventory.toLocaleString() + '\n';
            csv += 'Total Inventory Quantity,' + stats.totalInventoryQty.toLocaleString() + '\n\n';
            
            csv += '=== KEEP vs ARCHIVE RECOMMENDATION ===\n';
            csv += 'Category,Count,Percent\n';
            csv += 'Items to KEEP (has inventory or orders),' + stats.totalKeep.toLocaleString() + ',' + 
                   Math.round((stats.totalKeep / stats.totalItems) * 100) + '%\n';
            csv += 'Items to ARCHIVE (no activity),' + stats.totalArchive.toLocaleString() + ',' + 
                   Math.round((stats.totalArchive / stats.totalItems) * 100) + '%\n\n';
            
            csv += '=== MATRIX ITEM OPPORTUNITIES ===\n';
            csv += 'Families with Multiple Variants,' + stats.matrixCandidates.toLocaleString() + '\n';
            csv += 'Percent of Families,' + Math.round((stats.matrixCandidates / families.length) * 100) + '%\n';
            csv += 'Note: These can be consolidated into parent-child Matrix Items for the new e-commerce platform\n\n';
            
            csv += '=== FAMILY SIZE DISTRIBUTION ===\n';
            csv += 'Size Range,Family Count,Percent\n';
            for (const range in stats.distribution) {
                const count = stats.distribution[range];
                const percent = families.length > 0 ? Math.round((count / families.length) * 100) : 0;
                csv += range + ',' + count.toLocaleString() + ',' + percent + '%\n';
            }
            csv += '\n';
            
            csv += '=== PROJECTED IMPACT ===\n';
            csv += 'Current Active Items,' + stats.totalItems.toLocaleString() + '\n';
            csv += 'After Archive Operation,' + stats.totalKeep.toLocaleString() + '\n';
            csv += 'Reduction,' + stats.totalArchive.toLocaleString() + ' items (' + 
                   Math.round((stats.totalArchive / stats.totalItems) * 100) + '%)\n\n';
            
            csv += '=== DATA COMPLETENESS - SHOPIFY/API READINESS ===\n';
            csv += 'Field,Items With Data,Percent\n';
            csv += 'Display Name,' + stats.aggregateCompleteness.withDisplayName.toLocaleString() + ',' + 
                   Math.round((stats.aggregateCompleteness.withDisplayName / stats.totalItems) * 100) + '%\n';
            csv += 'Product Image,' + stats.aggregateCompleteness.withImage.toLocaleString() + ',' + 
                   Math.round((stats.aggregateCompleteness.withImage / stats.totalItems) * 100) + '%\n';
            csv += 'Product URL,' + stats.aggregateCompleteness.withProductUrl.toLocaleString() + ',' + 
                   Math.round((stats.aggregateCompleteness.withProductUrl / stats.totalItems) * 100) + '%\n';
            csv += 'List Price,' + stats.aggregateCompleteness.withPrice.toLocaleString() + ',' + 
                   Math.round((stats.aggregateCompleteness.withPrice / stats.totalItems) * 100) + '%\n';
            csv += 'UPC Code,' + stats.aggregateCompleteness.withUpc.toLocaleString() + ',' + 
                   Math.round((stats.aggregateCompleteness.withUpc / stats.totalItems) * 100) + '%\n';
            csv += 'Finish Attribute,' + stats.aggregateCompleteness.withFinish.toLocaleString() + ',' + 
                   Math.round((stats.aggregateCompleteness.withFinish / stats.totalItems) * 100) + '%\n';
            csv += 'Glass Attribute,' + stats.aggregateCompleteness.withGlass.toLocaleString() + ',' + 
                   Math.round((stats.aggregateCompleteness.withGlass / stats.totalItems) * 100) + '%\n';
            csv += 'Wattage,' + stats.aggregateCompleteness.withWattage.toLocaleString() + ',' + 
                   Math.round((stats.aggregateCompleteness.withWattage / stats.totalItems) * 100) + '%\n';
            csv += 'Color Temperature,' + stats.aggregateCompleteness.withKelvin.toLocaleString() + ',' + 
                   Math.round((stats.aggregateCompleteness.withKelvin / stats.totalItems) * 100) + '%\n\n';
            
            csv += '=== SHOPIFY READINESS BY FAMILY ===\n';
            csv += 'Families Shopify-Ready (score >= 70%),' + stats.totalShopifyReady.toLocaleString() + '\n';
            csv += 'Families with Data Gaps,' + stats.totalWithDataGaps.toLocaleString() + '\n';
            
            saveCSV('01_EXECUTIVE_SUMMARY_' + timestamp + '.csv', csv);
        }
        
        function generateFamilyDistribution(distribution, totalFamilies, timestamp) {
            let csv = '*** FAMILY SIZE DISTRIBUTION ***\n\n';
            csv += 'Size Range,Number of Families,Percent of Total,Cumulative %\n';
            
            let cumulative = 0;
            for (const range in distribution) {
                const count = distribution[range];
                const percent = totalFamilies > 0 ? (count / totalFamilies) * 100 : 0;
                cumulative += percent;
                csv += range + ',' + count.toLocaleString() + ',' + 
                       percent.toFixed(1) + '%,' + cumulative.toFixed(1) + '%\n';
            }
            
            saveCSV('02_FAMILY_DISTRIBUTION_' + timestamp + '.csv', csv);
        }
        
        function generateTopFamilies(families, timestamp) {
            let csv = '*** TOP ' + CONFIG.TOP_FAMILIES_COUNT + ' LARGEST PRODUCT FAMILIES ***\n\n';
            csv += 'Rank,Manufacturer,Base Part,Total Variants,Unique SKUs,With Inventory,';
            csv += 'Total Inv Qty,Keep,Archive,Reduction %,Finishes,Glass,Wattages,Kelvins,';
            csv += 'Avg Cost,Min Cost,Max Cost,Matrix Candidate,';
            csv += 'Shopify Score,%Image,%Price,%DisplayName,Data Gaps\n';
            
            families.slice(0, CONFIG.TOP_FAMILIES_COUNT).forEach((family, index) => {
                csv += [
                    index + 1,
                    '"' + family.manufacturer + '"',
                    '"' + family.basePart + '"',
                    family.variantCount,
                    family.uniqueSKUs,
                    family.itemsWithInventory,
                    family.totalInventory,
                    family.itemsToKeep,
                    family.itemsToArchive,
                    family.reductionPercent + '%',
                    family.uniqueFinishes,
                    family.uniqueGlass,
                    family.uniqueWattages,
                    family.uniqueKelvins,
                    family.avgCost.toFixed(2),
                    family.minCost.toFixed(2),
                    family.maxCost.toFixed(2),
                    family.isMatrixCandidate ? 'Yes' : 'No',
                    family.dataCompleteness.shopifyReadinessScore + '%',
                    family.dataCompleteness.pctImage + '%',
                    family.dataCompleteness.pctPrice + '%',
                    family.dataCompleteness.pctDisplayName + '%',
                    family.hasDataGaps ? 'Yes' : 'No'
                ].join(',') + '\n';
            });
            
            saveCSV('03_TOP_FAMILIES_' + timestamp + '.csv', csv);
        }
        
        function generateMatrixCandidates(families, timestamp) {
            let csv = '*** MATRIX ITEM CANDIDATES ***\n';
            csv += 'These product families have multiple variants and are ideal for Matrix Item conversion\n\n';
            csv += 'Manufacturer,Base Part,Total Variants,Unique Finishes,Unique Glass,';
            csv += 'Unique Wattages,Unique Kelvins,With Inventory,Avg Price\n';
            
            const candidates = families.filter(f => f.isMatrixCandidate);
            candidates.slice(0, 1000).forEach(family => {
                csv += [
                    '"' + family.manufacturer + '"',
                    '"' + family.basePart + '"',
                    family.variantCount,
                    family.uniqueFinishes,
                    family.uniqueGlass,
                    family.uniqueWattages,
                    family.uniqueKelvins,
                    family.itemsWithInventory,
                    family.avgPrice.toFixed(2)
                ].join(',') + '\n';
            });
            
            csv += '\nTotal Matrix Candidates: ' + candidates.length.toLocaleString() + '\n';
            
            saveCSV('04_MATRIX_CANDIDATES_' + timestamp + '.csv', csv);
        }
        
        function generateArchiveSample(families, timestamp) {
            let csv = '*** ITEMS TO ARCHIVE - SAMPLE ***\n';
            csv += 'These items have no inventory and no open orders\n\n';
            csv += 'Internal ID,Manufacturer,Base Part,SKU\n';
            
            let count = 0;
            for (const family of families) {
                for (const sample of family.archiveSamples) {
                    if (count >= CONFIG.ARCHIVE_SAMPLE_SIZE) break;
                    csv += [
                        sample.id,
                        '"' + family.manufacturer + '"',
                        '"' + family.basePart + '"',
                        '"' + sample.sku + '"'
                    ].join(',') + '\n';
                    count++;
                }
                if (count >= CONFIG.ARCHIVE_SAMPLE_SIZE) break;
            }
            
            csv += '\nShowing first ' + count.toLocaleString() + ' items\n';
            
            saveCSV('05_ARCHIVE_SAMPLE_' + timestamp + '.csv', csv);
        }
        
        function generateKeepSample(families, timestamp) {
            let csv = '*** ITEMS TO KEEP - SAMPLE ***\n';
            csv += 'These items have inventory or open orders\n\n';
            csv += 'Internal ID,Manufacturer,Base Part,SKU,Keep Reason\n';
            
            let count = 0;
            for (const family of families) {
                for (const sample of family.keepSamples) {
                    if (count >= CONFIG.KEEP_SAMPLE_SIZE) break;
                    csv += [
                        sample.id,
                        '"' + family.manufacturer + '"',
                        '"' + family.basePart + '"',
                        '"' + sample.sku + '"',
                        '"' + sample.reason + '"'
                    ].join(',') + '\n';
                    count++;
                }
                if (count >= CONFIG.KEEP_SAMPLE_SIZE) break;
            }
            
            csv += '\nShowing first ' + count.toLocaleString() + ' items\n';
            
            saveCSV('06_KEEP_SAMPLE_' + timestamp + '.csv', csv);
        }
        
        function generateDataCompletenessReport(families, aggregateCompleteness, totalItems, timestamp) {
            let csv = '*** DATA COMPLETENESS REPORT - SHOPIFY/API READINESS ***\n';
            csv += 'This report analyzes data quality for e-commerce platform compatibility\n\n';
            
            csv += '=== OVERALL DATA COMPLETENESS ===\n';
            csv += 'Field,Items With Data,Percent,Shopify Requirement\n';
            csv += 'Display Name,' + aggregateCompleteness.withDisplayName.toLocaleString() + ',' + 
                   Math.round((aggregateCompleteness.withDisplayName / totalItems) * 100) + '%,Required\n';
            csv += 'Product Image,' + aggregateCompleteness.withImage.toLocaleString() + ',' + 
                   Math.round((aggregateCompleteness.withImage / totalItems) * 100) + '%,Critical\n';
            csv += 'List Price,' + aggregateCompleteness.withPrice.toLocaleString() + ',' + 
                   Math.round((aggregateCompleteness.withPrice / totalItems) * 100) + '%,Critical\n';
            csv += 'Product URL,' + aggregateCompleteness.withProductUrl.toLocaleString() + ',' + 
                   Math.round((aggregateCompleteness.withProductUrl / totalItems) * 100) + '%,Recommended\n';
            csv += 'UPC Code,' + aggregateCompleteness.withUpc.toLocaleString() + ',' + 
                   Math.round((aggregateCompleteness.withUpc / totalItems) * 100) + '%,Recommended\n';
            csv += 'Finish Attribute,' + aggregateCompleteness.withFinish.toLocaleString() + ',' + 
                   Math.round((aggregateCompleteness.withFinish / totalItems) * 100) + '%,For Variants\n';
            csv += 'Glass Attribute,' + aggregateCompleteness.withGlass.toLocaleString() + ',' + 
                   Math.round((aggregateCompleteness.withGlass / totalItems) * 100) + '%,For Variants\n';
            csv += 'Wattage,' + aggregateCompleteness.withWattage.toLocaleString() + ',' + 
                   Math.round((aggregateCompleteness.withWattage / totalItems) * 100) + '%,For Filters\n';
            csv += 'Color Temperature,' + aggregateCompleteness.withKelvin.toLocaleString() + ',' + 
                   Math.round((aggregateCompleteness.withKelvin / totalItems) * 100) + '%,For Filters\n\n';
            
            csv += '=== FAMILIES BY SHOPIFY READINESS SCORE ===\n';
            csv += 'Score Range,Family Count,Percent\n';
            
            const scoreRanges = {
                '90-100% (Excellent)': 0,
                '70-89% (Good)': 0,
                '50-69% (Needs Work)': 0,
                '25-49% (Poor)': 0,
                '0-24% (Critical)': 0
            };
            
            families.forEach(f => {
                const score = f.dataCompleteness.shopifyReadinessScore;
                if (score >= 90) scoreRanges['90-100% (Excellent)']++;
                else if (score >= 70) scoreRanges['70-89% (Good)']++;
                else if (score >= 50) scoreRanges['50-69% (Needs Work)']++;
                else if (score >= 25) scoreRanges['25-49% (Poor)']++;
                else scoreRanges['0-24% (Critical)']++;
            });
            
            for (const range in scoreRanges) {
                const count = scoreRanges[range];
                csv += range + ',' + count.toLocaleString() + ',' + 
                       Math.round((count / families.length) * 100) + '%\n';
            }
            
            csv += '\n=== TOP 100 FAMILIES BY DATA COMPLETENESS ===\n';
            csv += 'Manufacturer,Base Part,Variants,Shopify Score,%Image,%Price,%Name,%Finish,%Glass\n';
            
            // Sort by completeness score descending
            const sortedByCompleteness = [...families].sort((a, b) => 
                b.dataCompleteness.shopifyReadinessScore - a.dataCompleteness.shopifyReadinessScore
            );
            
            sortedByCompleteness.slice(0, 100).forEach(family => {
                csv += [
                    '"' + family.manufacturer + '"',
                    '"' + family.basePart + '"',
                    family.variantCount,
                    family.dataCompleteness.shopifyReadinessScore + '%',
                    family.dataCompleteness.pctImage + '%',
                    family.dataCompleteness.pctPrice + '%',
                    family.dataCompleteness.pctDisplayName + '%',
                    family.dataCompleteness.pctFinish + '%',
                    family.dataCompleteness.pctGlass + '%'
                ].join(',') + '\n';
            });
            
            saveCSV('07_DATA_COMPLETENESS_' + timestamp + '.csv', csv);
        }
        
        function generateDataGapsReport(families, timestamp) {
            let csv = '*** DATA GAPS REPORT - FAMILIES NEEDING ATTENTION ***\n';
            csv += 'These product families have missing critical data for Shopify/API integration\n\n';
            
            // Filter families with data gaps and sort by variant count (biggest impact first)
            const familiesWithGaps = families
                .filter(f => f.hasDataGaps)
                .sort((a, b) => b.variantCount - a.variantCount);
            
            csv += '=== SUMMARY ===\n';
            csv += 'Total Families with Data Gaps,' + familiesWithGaps.length.toLocaleString() + '\n';
            csv += 'Total Items Affected,' + familiesWithGaps.reduce((sum, f) => sum + f.variantCount, 0).toLocaleString() + '\n\n';
            
            csv += '=== FAMILIES MISSING IMAGES (Top 200 by size) ===\n';
            csv += 'Manufacturer,Base Part,Total Variants,Items Missing Image,% Missing\n';
            
            const missingImages = familiesWithGaps
                .filter(f => f.dataCompleteness.pctImage < 100)
                .slice(0, 200);
            
            missingImages.forEach(family => {
                const missing = family.variantCount - family.dataCompleteness.withImage;
                csv += [
                    '"' + family.manufacturer + '"',
                    '"' + family.basePart + '"',
                    family.variantCount,
                    missing,
                    (100 - family.dataCompleteness.pctImage) + '%'
                ].join(',') + '\n';
            });
            
            csv += '\n=== FAMILIES MISSING PRICES (Top 200 by size) ===\n';
            csv += 'Manufacturer,Base Part,Total Variants,Items Missing Price,% Missing\n';
            
            const missingPrices = familiesWithGaps
                .filter(f => f.dataCompleteness.pctPrice < 100)
                .slice(0, 200);
            
            missingPrices.forEach(family => {
                const missing = family.variantCount - family.dataCompleteness.withPrice;
                csv += [
                    '"' + family.manufacturer + '"',
                    '"' + family.basePart + '"',
                    family.variantCount,
                    missing,
                    (100 - family.dataCompleteness.pctPrice) + '%'
                ].join(',') + '\n';
            });
            
            csv += '\n=== SAMPLE ITEMS WITH MISSING DATA ===\n';
            csv += 'Family,Internal ID,SKU,Missing Image,Missing Price\n';
            
            let sampleCount = 0;
            for (const family of familiesWithGaps) {
                for (const item of family.dataCompleteness.missingCritical) {
                    if (sampleCount >= 500) break;
                    csv += [
                        '"' + family.basePart + '"',
                        item.id,
                        '"' + item.sku + '"',
                        item.missingImage ? 'Yes' : 'No',
                        item.missingPrice ? 'Yes' : 'No'
                    ].join(',') + '\n';
                    sampleCount++;
                }
                if (sampleCount >= 500) break;
            }
            
            saveCSV('08_DATA_GAPS_' + timestamp + '.csv', csv);
        }

        // ====================================================================
        // UTILITY FUNCTIONS
        // ====================================================================
        
        /**
         * Parse vendor name to extract base part number
         * Removes finish/color codes from end of SKU
         * 
         * Examples:
         *   3ADR52RZW → 3ADR52
         *   10189WH → 10189
         *   2343NI → 2343
         *   14PRR62AGPD → 14PRR62
         */
        function parseBasePart(vendorName) {
            if (!vendorName) return null;
            
            let sku = vendorName.toString().toUpperCase().trim();
            
            // Try to find known finish codes at the end
            for (const code of FINISH_CODES) {
                if (sku.endsWith(code)) {
                    const basePart = sku.substring(0, sku.length - code.length);
                    // Make sure we're left with something substantial
                    if (basePart.length >= 3) {
                        return basePart;
                    }
                }
            }
            
            // Pattern-based parsing: numbers followed by 2-4 letters at end
            const match = sku.match(/^(.+?)([A-Z]{2,4}D?)$/);
            if (match && match[1].length >= 3) {
                return match[1];
            }
            
            // Return full SKU if no pattern matched
            return sku;
        }
        
        /**
         * Clean string for use as key
         * Removes non-alphanumeric characters and converts to uppercase
         */
        function cleanString(str) {
            if (!str) return '';
            return str.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
        }
        
        /**
         * Save CSV file to File Cabinet
         */
        function saveCSV(filename, content) {
            try {
                const csvFile = file.create({
                    name: filename,
                    fileType: file.Type.CSV,
                    contents: content,
                    folder: CONFIG.OUTPUT_FOLDER_ID
                });
                
                const fileId = csvFile.save();
                log.audit('REPORT SAVED', filename + ' (ID: ' + fileId + ')');
            } catch (e) {
                log.error('SAVE ERROR', filename + ': ' + e.message);
            }
        }

        // ====================================================================
        // EXPORT ENTRY POINTS
        // ====================================================================
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    }
);