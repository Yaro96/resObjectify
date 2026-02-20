let objectify=require("resobjectify")

let arr=[{id:111,code:'aaa',name:"prova", rule_id:1, formula:"asd", meter_id:8,area_id:31},
    {id:111,code:'aaa',name:"prova", rule_id:1, formula:"asd", meter_id:8,area_id:95},
    {id:111,code:'aaa',name:"prova", rule_id:1, formula:"asd", meter_id:10,area_id:31},
    {id:111,code:'aaa',name:"prova", rule_id:1, formula:"asd", meter_id:10,area_id:95},
    {id:111,code:'aaa',name:"prova", rule_id:2, formula:"asd", meter_id:10,area_id:95}];
	
let fields=[{key:"id", as:"area_id"},{key:"code", as:"area_code"},"name", ["rules",["rule_id",{key:"formula", as:"rule"},[{name:"meters",object:true},[{key:"meter_id", as:"id"}]],[{name:"areas",object:false},["area_id"]]]]];

console.log(JSON.stringify(objectify(arr,fields)))