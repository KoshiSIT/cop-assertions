function expressionInterpreter(expression, contextObj) {
    let result;

    try {
        const func = new Function(...Object.keys(contextObj), `return ${expression};`);
        result = func(...Object.values(contextObj));
    } catch (error) {
        if (error instanceof ReferenceError) {
            return false;
        } else {
            throw error;
        }
    }
    return result;
}

export default expressionInterpreter;
