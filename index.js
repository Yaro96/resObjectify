function objectify(arr, fields, object = false, index = 0, parents = []) {
    /*arr=[{id:111,code:'aaa',name:"prova", rule_id:1, formula:"asd", meter_id:8,area_id:31},
    {id:111,code:'aaa',name:"prova", rule_id:2, formula:"asd", meter_id:8,area_id:95},
    {id:111,code:'aaa',name:"prova", rule_id:1, formula:"asd", meter_id:10,area_id:31},
    {id:111,code:'aaa',name:"prova", rule_id:1, formula:"asd", meter_id:10,area_id:95},
    {id:111,code:'aaa',name:"prova", rule_id:2, formula:"asd", meter_id:10,area_id:95}]*/
    //fields=[{key:"id", as:"area_id"},{key:"code", as:"area_code"},"name", ["rules",["rule_id",{key:"formula", as:"rule"},[{name:"meters",object:true},[{key:"meter_id", as:"id"}]],[{name:"areas",object:false},["area_id"]]]]]
    let result = fields.length == 1 ? [] : object ? {} : [];
    let added = [];

    for (let j = index; j < arr.length; j++) {
        if (!checkParents(arr, j, index, parents) || added.includes(arr[j][fields[0].key || fields[0]]))
            continue;

        let obj = {};
        for (let f of fields) {
            if (!Array.isArray(f)) {
                obj[f.as || f.key || f] = f.json ? (arr[j][f.key || f] === null ? null : JSON.parse(arr[j][f.key || f])) : arr[j][f.key || f];
            } else {
                obj[f[0].name || f[0]] = objectify(arr, f[1], f[0].object != undefined ? f[0].object : object, j, [...parents, fields[0].key || fields[0]]);
            }
        }
        added.push(arr[j][fields[0].key || fields[0]]);
        if (obj[fields[0].as || fields[0].key || fields[0]] != null) {
            if (fields.length == 1)
                result.push(obj[fields[0].as || fields[0].key || fields[0]]);
            else if (object)
                result[arr[j][fields[0].key || fields[0]]] = obj;
            else
                result.push(obj);
        }
    }
    return result;
}

function checkParents(arr, j, index, parents) {
    for (let parent of parents) {
        if (arr[j][parent] != arr[index][parent])
            return false;
    }
    return true;
}

module.exports = objectify;