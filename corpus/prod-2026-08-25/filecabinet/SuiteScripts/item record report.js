/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 * 
 * QUICK CATALOG ANALYSIS - INVENTORY ONLY
 * 
 * This version SKIPS sales history to avoid errors
 * Uses inventory-only for keep/archive decisions
 * 
 * Runtime: 15-20 minutes
 */

define(['N/search', 'N/file', 'N/runtime', 'N/format'],
    function(search, file, runtime, format) {
        
        function execute(context) {
            var startTime = Date.now();
            log.audit('Starting Quick Catalog Analysis', 'Inventory-based only');
            
            try {
                // Step 1: Build family structure
                log.audit('Step 1', 'Analyzing item families...');
                var families = analyzeItemFamilies();
                
                // Step 2: Apply business rules (inventory only)
                log.audit('Step 2', 'Applying keep/archive rules (inventory-based)...');
                var decisions = applyBusinessRules(families);
                
                // Step 3: Generate reports
                log.audit('Step 3', 'Generating reports...');
                generateReports(families, decisions);
                
                var elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
                log.audit('Analysis Complete', {
                    totalFamilies: Object.keys(families).length,
                    elapsedMinutes: elapsed,
                    reportsLocation: 'File Cabinet'
                });
                
            } catch (e) {
                log.error('Analysis Error', e.message + '\n' + e.stack);
            }
        }
        
        function analyzeItemFamilies() {
            var families = {};
            var totalProcessed = 0;
            
            // Search ALL active inventory items
            var itemSearch = search.create({
                type: search.Type.INVENTORY_ITEM,
                filters: [
                    ['isinactive', 'is', 'F']
                ],
                columns: [
                    'internalid',
                    'itemid',
                    'displayname',
                    'custitem_la_manufacturer_number',
                    'custitem_la_manufacturer_name',
                    'custitem_la_manufacturer_finish',
                    'custitem_la_manufacturer_glass',
                    'custitem_la_max_wattage',
                    'custitem_la_color_temperature',
                    'cost',
                    'custitem_la_list_price',
                    'quantityonhand',
                    'quantityonorder'
                ]
            });
            
            var pagedData = itemSearch.runPaged({pageSize: 1000});
            var pageCount = pagedData.pageRanges.length;
            
            log.audit('Total Pages', pageCount);
            
            for (var i = 0; i < pageCount; i++) {
                var currentPage = pagedData.fetch({index: i});
                
                currentPage.data.forEach(function(result) {
                    var mfgPartNum = result.getValue('custitem_la_manufacturer_number');
                    var manufacturer = result.getValue('custitem_la_manufacturer_name');
                    
                    if (!mfgPartNum || !manufacturer) {
                        return;
                    }
                    
                    // Create family key: MANUFACTURER-BASEPART
                    var familyKey = cleanString(manufacturer) + '-' + cleanString(mfgPartNum);
                    
                    if (!families[familyKey]) {
                        families[familyKey] = {
                            manufacturer: manufacturer,
                            basePartNumber: mfgPartNum,
                            familyKey: familyKey,
                            variants: [],
                            variantCount: 0,
                            finishes: {},
                            glassTypes: {},
                            wattages: {},
                            kelvins: {},
                            itemsWithInventory: 0,
                            totalInventory: 0,
                            itemsOnOrder: 0,
                            itemsToKeep: 0,
                            itemsToArchive: 0,
                            totalCost: 0,
                            avgCost: 0
                        };
                    }
                    
                    var family = families[familyKey];
                    
                    var itemPrice = parseFloat(result.getValue('custitem_la_list_price') || 0);
                    var itemCost = parseFloat(result.getValue('cost') || 0);
                    var qtyOnHand = parseFloat(result.getValue('quantityonhand') || 0);
                    var qtyOnOrder = parseFloat(result.getValue('quantityonorder') || 0);
                    
                    var variant = {
                        internalId: result.getValue('internalid'),
                        itemId: result.getValue('itemid'),
                        displayName: result.getValue('displayname'),
                        finish: result.getValue('custitem_la_manufacturer_finish'),
                        glass: result.getValue('custitem_la_manufacturer_glass'),
                        wattage: result.getValue('custitem_la_max_wattage'),
                        kelvin: result.getValue('custitem_la_color_temperature'),
                        cost: itemCost,
                        price: itemPrice,
                        qtyOnHand: qtyOnHand,
                        qtyOnOrder: qtyOnOrder
                    };
                    
                    family.variants.push(variant);
                    family.variantCount++;
                    family.totalCost += itemCost;
                    
                    // Track unique variant options
                    if (variant.finish) family.finishes[variant.finish] = true;
                    if (variant.glass) family.glassTypes[variant.glass] = true;
                    if (variant.wattage) family.wattages[variant.wattage] = true;
                    if (variant.kelvin) family.kelvins[variant.kelvin] = true;
                    
                    // Track inventory
                    if (qtyOnHand > 0) {
                        family.itemsWithInventory++;
                        family.totalInventory += qtyOnHand;
                    }
                    if (qtyOnOrder > 0) {
                        family.itemsOnOrder++;
                    }
                });
                
                totalProcessed += currentPage.data.length;
                
                if (totalProcessed % 50000 === 0) {
                    log.audit('Progress', totalProcessed + ' items processed');
                }
            }
            
            // Calculate averages
            for (var key in families) {
                var family = families[key];
                family.avgCost = family.variantCount > 0 ? 
                    family.totalCost / family.variantCount : 0;
            }
            
            log.audit('Item Analysis Complete', {
                totalItems: totalProcessed,
                totalFamilies: Object.keys(families).length
            });
            
            return families;
        }
        
        function applyBusinessRules(families) {
            /**
             * SIMPLIFIED RULES (NO SALES DATA):
             * 
             * KEEP IF:
             * - Has inventory on hand, OR
             * - Has open orders
             * 
             * ARCHIVE:
             * - Everything else
             */
            
            var summary = {
                totalItems: 0,
                totalFamilies: Object.keys(families).length,
                itemsToKeep: 0,
                itemsToArchive: 0,
                keptForInventory: 0,
                keptForOrders: 0,
                familiesAllKeep: 0,
                familiesAllArchive: 0,
                familiesMixed: 0,
                distribution: {
                    '1': 0,
                    '2-10': 0,
                    '11-100': 0,
                    '101-500': 0,
                    '501-1000': 0,
                    '1001-5000': 0,
                    '5001-10000': 0,
                    '10000+': 0
                }
            };
            
            for (var familyKey in families) {
                var family = families[familyKey];
                
                family.variants.forEach(function(variant) {
                    summary.totalItems++;
                    
                    var keep = false;
                    var reasons = [];
                    
                    if (variant.qtyOnHand > 0) {
                        keep = true;
                        reasons.push('Inventory: ' + variant.qtyOnHand);
                        summary.keptForInventory++;
                    }
                    
                    if (variant.qtyOnOrder > 0) {
                        keep = true;
                        reasons.push('On Order: ' + variant.qtyOnOrder);
                        summary.keptForOrders++;
                    }
                    
                    variant.keep = keep;
                    variant.keepReasons = reasons;
                    
                    if (keep) {
                        family.itemsToKeep++;
                        summary.itemsToKeep++;
                    } else {
                        family.itemsToArchive++;
                        summary.itemsToArchive++;
                    }
                });
                
                if (family.itemsToKeep === family.variantCount) {
                    summary.familiesAllKeep++;
                } else if (family.itemsToArchive === family.variantCount) {
                    summary.familiesAllArchive++;
                } else {
                    summary.familiesMixed++;
                }
                
                // Distribution (adjusted for large families)
                var count = family.variantCount;
                if (count === 1) {
                    summary.distribution['1']++;
                } else if (count <= 10) {
                    summary.distribution['2-10']++;
                } else if (count <= 100) {
                    summary.distribution['11-100']++;
                } else if (count <= 500) {
                    summary.distribution['101-500']++;
                } else if (count <= 1000) {
                    summary.distribution['501-1000']++;
                } else if (count <= 5000) {
                    summary.distribution['1001-5000']++;
                } else if (count <= 10000) {
                    summary.distribution['5001-10000']++;
                } else {
                    summary.distribution['10000+']++;
                }
            }
            
            log.audit('Business Rules Applied', {
                itemsToKeep: summary.itemsToKeep,
                itemsToArchive: summary.itemsToArchive,
                reductionPercent: Math.round((summary.itemsToArchive / summary.totalItems) * 100)
            });
            
            return summary;
        }
        
        function generateReports(families, summary) {
            var timestamp = format.format({
                value: new Date(),
                type: format.Type.DATETIME
            }).replace(/[\/: ]/g, '_');
            
            generateExecutiveSummary(summary, timestamp);
            generateFamilyDistribution(summary, timestamp);
            generateAllFamilies(families, timestamp);
            generateArchiveList(families, timestamp);
            generateKeepList(families, timestamp);
        }
        
        function generateExecutiveSummary(summary, timestamp) {
            var csv = '*** CATALOG CONSOLIDATION ANALYSIS - EXECUTIVE SUMMARY ***\n';
            csv += 'Generated: ' + new Date().toISOString() + '\n';
            csv += 'NOTE: This analysis uses INVENTORY ONLY (no sales history)\n\n';
            
            csv += '=== CRITICAL DISCOVERY ===\n';
            csv += 'Total Active Items,' + summary.totalItems.toLocaleString() + '\n';
            csv += 'Total Product Families,' + summary.totalFamilies.toLocaleString() + '\n';
            csv += 'Average Variants per Family,' + Math.round(summary.totalItems / summary.totalFamilies).toLocaleString() + '\n';
            csv += '\n';
            csv += '*** THIS IS EXTREME VARIANT EXPLOSION! ***\n';
            csv += 'With only ' + summary.totalFamilies + ' families and 1.1M items\n';
            csv += 'You have an average of ' + Math.round(summary.totalItems / summary.totalFamilies).toLocaleString() + ' variants per family!\n';
            csv += '\n';
            
            csv += '=== KEEP vs ARCHIVE (INVENTORY-BASED) ===\n';
            csv += 'Category,Count,Percent\n';
            csv += 'Items to KEEP,' + summary.itemsToKeep.toLocaleString() + ',' + 
                   Math.round((summary.itemsToKeep / summary.totalItems) * 100) + '%\n';
            csv += 'Items to ARCHIVE,' + summary.itemsToArchive.toLocaleString() + ',' + 
                   Math.round((summary.itemsToArchive / summary.totalItems) * 100) + '%\n';
            csv += '\n';
            
            csv += '=== KEEP REASONS ===\n';
            csv += 'Reason,Count\n';
            csv += 'Has Inventory,' + summary.keptForInventory.toLocaleString() + '\n';
            csv += 'Has Open Orders,' + summary.keptForOrders.toLocaleString() + '\n';
            csv += 'NOTE: Sales data not included in this analysis\n\n';
            
            csv += '=== FAMILY SIZE DISTRIBUTION ===\n';
            csv += 'Variant Count Range,Number of Families\n';
            for (var range in summary.distribution) {
                csv += range + ' variants,' + summary.distribution[range].toLocaleString() + '\n';
            }
            csv += '\n';
            
            csv += '=== FAMILY STATUS ===\n';
            csv += 'Status,Count,Percent\n';
            csv += 'All Variants to Keep,' + summary.familiesAllKeep.toLocaleString() + ',' + 
                   Math.round((summary.familiesAllKeep / summary.totalFamilies) * 100) + '%\n';
            csv += 'All Variants to Archive,' + summary.familiesAllArchive.toLocaleString() + ',' + 
                   Math.round((summary.familiesAllArchive / summary.totalFamilies) * 100) + '%\n';
            csv += 'Mixed,' + summary.familiesMixed.toLocaleString() + ',' + 
                   Math.round((summary.familiesMixed / summary.totalFamilies) * 100) + '%\n';
            csv += '\n';
            
            csv += '=== NEXT STEPS ===\n';
            csv += '1. Review "ALL_46_FAMILIES" report to see what these families are\n';
            csv += '2. Identify which families need consolidation\n';
            csv += '3. Get XO Logic API access to see their variant structure\n';
            csv += '4. Build consolidation plan\n';
            
            saveCSV('1_EXECUTIVE_SUMMARY_' + timestamp + '.csv', csv);
        }
        
        function generateFamilyDistribution(summary, timestamp) {
            var csv = 'FAMILY SIZE DISTRIBUTION\n\n';
            csv += 'Variant Count Range,Number of Families,Percent of Total\n';
            
            for (var range in summary.distribution) {
                var count = summary.distribution[range];
                var percent = summary.totalFamilies > 0 ? 
                    Math.round((count / summary.totalFamilies) * 100) : 0;
                csv += range + ',' + count.toLocaleString() + ',' + percent + '%\n';
            }
            
            saveCSV('2_FAMILY_DISTRIBUTION_' + timestamp + '.csv', csv);
        }
        
        function generateAllFamilies(families, timestamp) {
            var csv = '*** ALL 46 FAMILIES - COMPLETE LIST ***\n\n';
            csv += 'Rank,Manufacturer,Base Part Number,Total Variants,Items with Inventory,Never Had Inventory,Total Inventory Qty,Items On Order,Keep Count,Archive Count,Reduction %,Unique Finishes,Unique Glass Types,Unique Wattages,Unique Kelvins,Avg Cost\n';
            
            var sortedFamilies = [];
            for (var key in families) {
                sortedFamilies.push(families[key]);
            }
            sortedFamilies.sort(function(a, b) {
                return b.variantCount - a.variantCount;
            });
            
            sortedFamilies.forEach(function(family, index) {
                var reductionPercent = family.variantCount > 0 ? 
                    Math.round((family.itemsToArchive / family.variantCount) * 100) : 0;
                
                var neverHadInventory = family.variantCount - family.itemsWithInventory;
                
                csv += [
                    index + 1,
                    '"' + family.manufacturer + '"',
                    '"' + family.basePartNumber + '"',
                    family.variantCount.toLocaleString(),
                    family.itemsWithInventory.toLocaleString(),
                    neverHadInventory.toLocaleString(),
                    family.totalInventory.toLocaleString(),
                    family.itemsOnOrder,
                    family.itemsToKeep.toLocaleString(),
                    family.itemsToArchive.toLocaleString(),
                    reductionPercent + '%',
                    Object.keys(family.finishes).length,
                    Object.keys(family.glassTypes).length,
                    Object.keys(family.wattages).length,
                    Object.keys(family.kelvins).length,
                    family.avgCost.toFixed(2)
                ].join(',') + '\n';
            });
            
            csv += '\n\n*** KEY INSIGHTS ***\n';
            csv += 'Look for families with:\n';
            csv += '- Extremely high variant counts (10,000+)\n';
            csv += '- High unique finish/glass/wattage counts\n';
            csv += '- High reduction potential\n';
            csv += '\nThese are your primary consolidation targets!\n';
            
            saveCSV('3_ALL_46_FAMILIES_' + timestamp + '.csv', csv);
        }
        
        function generateArchiveList(families, timestamp) {
            var csv = 'ITEMS TO ARCHIVE - SAMPLE (First 10,000)\n\n';
            csv += 'Internal ID,Item Number,Display Name,Manufacturer,Base Part Number,Finish,Glass,Wattage,Kelvin,Cost,Price,Reason\n';
            
            var count = 0;
            var maxRows = 10000;
            
            for (var familyKey in families) {
                var family = families[familyKey];
                
                family.variants.forEach(function(variant) {
                    if (!variant.keep && count < maxRows) {
                        csv += [
                            variant.internalId,
                            '"' + variant.itemId + '"',
                            '"' + variant.displayName + '"',
                            '"' + family.manufacturer + '"',
                            '"' + family.basePartNumber + '"',
                            '"' + (variant.finish || '') + '"',
                            '"' + (variant.glass || '') + '"',
                            variant.wattage || '',
                            variant.kelvin || '',
                            variant.cost,
                            variant.price,
                            '"No inventory, no orders"'
                        ].join(',') + '\n';
                        
                        count++;
                    }
                });
                
                if (count >= maxRows) break;
            }
            
            saveCSV('4_ARCHIVE_SAMPLE_' + timestamp + '.csv', csv);
        }
        
        function generateKeepList(families, timestamp) {
            var csv = 'ITEMS TO KEEP - SAMPLE (First 10,000)\n\n';
            csv += 'Internal ID,Item Number,Display Name,Manufacturer,Base Part Number,Finish,Glass,Wattage,Kelvin,Inventory Qty,On Order,Keep Reasons\n';
            
            var count = 0;
            var maxRows = 10000;
            
            for (var familyKey in families) {
                var family = families[familyKey];
                
                family.variants.forEach(function(variant) {
                    if (variant.keep && count < maxRows) {
                        csv += [
                            variant.internalId,
                            '"' + variant.itemId + '"',
                            '"' + variant.displayName + '"',
                            '"' + family.manufacturer + '"',
                            '"' + family.basePartNumber + '"',
                            '"' + (variant.finish || '') + '"',
                            '"' + (variant.glass || '') + '"',
                            variant.wattage || '',
                            variant.kelvin || '',
                            variant.qtyOnHand || 0,
                            variant.qtyOnOrder || 0,
                            '"' + variant.keepReasons.join('; ') + '"'
                        ].join(',') + '\n';
                        
                        count++;
                    }
                });
                
                if (count >= maxRows) break;
            }
            
            saveCSV('5_KEEP_SAMPLE_' + timestamp + '.csv', csv);
        }
        
        function saveCSV(filename, content) {
            try {
                var csvFile = file.create({
                    name: filename,
                    fileType: file.Type.CSV,
                    contents: content,
                    folder: -15
                });
                
                var fileId = csvFile.save();
                log.audit('Report Saved', filename + ' (ID: ' + fileId + ')');
            } catch (e) {
                log.error('Error Saving Report', filename + ': ' + e.message);
            }
        }
        
        function cleanString(str) {
            if (!str) return '';
            return str.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
        }
        
        return {
            execute: execute
        };
    }
);