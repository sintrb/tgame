let Context = {
    timeMap: {

    },
    idMap: {

    },
    index: 0,
};


function setTimer(func, time) {
    Context.index += 1;
    if (!Context.timeMap[time]) {
        let tfunc = function () {
            Context.timeMap[time].funcs.map(function(fu){
                fu();
            });
        }
        Context.timeMap[time] = {
            intervalId: setInterval(tfunc, time),
            funcs: []
        }
    }
    let ctm = Context.timeMap[time];
    ctm.funcs.push(func)
    Context.idMap[Context.index] = {
        time: time,
        func: func
    };
    console.log("---->add", time, func);
    console.log(Context);
    return Context.index;
}

function clearTimer(tmid) {
    if (Context.idMap[tmid]) {
        let idd = Context.idMap[tmid];
        let ctm = Context.timeMap[idd.time];
        delete Context.idMap[tmid];
        delete Context.timeMap[idd.time];
        ctm.funcs.splice(ctm.funcs.indexOf(idd.func), 1);
        console.log("---->remove", tmid, ctm);
        console.log(Console);
    }
}


export { setTimer, clearTimer }