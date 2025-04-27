export function diffTime(time: Date): Number {
    return Date.now() - new Date(time).getTime();
}

export function compareTime(time1: Number, time2: Number) {
    if (time1 > time2) {
        return 1;
    } else if (time1 < time2) {
        return -1;
    } else {
        return 0;
    }
}
