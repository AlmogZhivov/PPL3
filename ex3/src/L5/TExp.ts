/*
;; Type language
;; <texp>         ::= <atomic-te> | <compound-te> | <tvar>
;; <atomic-te>    ::= <num-te> | <bool-te> | <void-te>
;; <num-te>       ::= number   // num-te()
;; <bool-te>      ::= boolean  // bool-te()
;; <str-te>       ::= string   // str-te()
;; <void-te>      ::= void     // void-te()
;; <compound-te>  ::= <proc-te> | <tuple-te> | <union-te>
;; <non-tuple-te> ::= <atomic-te> | <proc-te> | <tvar>
;; <proc-te>      ::= [ <tuple-te> -> <non-tuple-te> ] // proc-te(param-tes: list(te), return-te: te)
;; <tuple-te>     ::= <non-empty-tuple-te> | <empty-te>
;; <non-empty-tuple-te> ::= ( <non-tuple-te> *)* <non-tuple-te> // tuple-te(tes: list(te))
;; <empty-te>     ::= Empty
;; <union-te>     ::= (union <texp> <texp>) // union-te(components: list(te))
;; <tvar>         ::= a symbol starting with T // tvar(id: Symbol, contents; Box(string|boolean))

;; Examples of type expressions
;; number
;; boolean
;; void
;; [number -> boolean]
;; [number * number -> boolean]
;; [number -> [number -> boolean]]
;; [Empty -> number]
;; [Empty -> void]

;; Support the following type expressions:
;; [union number boolean]
;; [union [union number boolean] string]
;; [Empty -> [union boolean number]]
;; [union [T1 -> T1] [Empty -> T1]]
*/

import { all, append, chain, concat, equals, map, sort, uniq, zip, filter, includes, is } from "ramda";
import { Sexp } from "s-expression";
import { List, isEmpty, isNonEmptyList } from "../shared/list";
import { isArray, isBoolean, isString } from '../shared/type-predicates';
import { makeBox, setBox, unbox, Box } from '../shared/box';
import { cons, first, rest } from '../shared/list';
import { Result, bind, makeOk, makeFailure, mapResult, mapv, either } from "../shared/result";
import { parse as p } from "../shared/parser";
import { format } from "../shared/format";

export type TExp =  AtomicTExp | CompoundTExp | TVar;
export const isTExp = (x: any): x is TExp => isAtomicTExp(x) || isCompoundTExp(x) || isTVar(x);

export type AtomicTExp = NumTExp | BoolTExp | StrTExp | VoidTExp | AnyTExp | NeverTExp;
export const isAtomicTExp = (x: any): x is AtomicTExp =>
    isNumTExp(x) || isBoolTExp(x) || isStrTExp(x) || isVoidTExp(x) || isAnyTExp(x) || isNeverTExp(x);

export type CompoundTExp = ProcTExp | TupleTExp | UnionTExp | InterTExp | PredTExp;
export const isCompoundTExp = (x: any): x is CompoundTExp => isProcTExp(x) || isTupleTExp(x) || 
    isUnionTExp(x) || isInterTExp(x) || isPredTExp(x);

export type NonTupleTExp = AtomicTExp | ProcTExp | TVar | UnionTExp;
export const isNonTupleTExp = (x: any): x is NonTupleTExp =>
    isAtomicTExp(x) || isProcTExp(x) || isTVar(x) || isUnionTExp(x) || isInterTExp(x);

export type NumTExp = { tag: "NumTExp" };
export const makeNumTExp = (): NumTExp => ({tag: "NumTExp"});
export const isNumTExp = (x: any): x is NumTExp => x.tag === "NumTExp";

export type BoolTExp = { tag: "BoolTExp" };
export const makeBoolTExp = (): BoolTExp => ({tag: "BoolTExp"});
export const isBoolTExp = (x: any): x is BoolTExp => x.tag === "BoolTExp";

export type StrTExp = { tag: "StrTExp" };
export const makeStrTExp = (): StrTExp => ({tag: "StrTExp"});
export const isStrTExp = (x: any): x is StrTExp => x.tag === "StrTExp";

export type VoidTExp = { tag: "VoidTExp" };
export const makeVoidTExp = (): VoidTExp => ({tag: "VoidTExp"});
export const isVoidTExp = (x: any): x is VoidTExp => x.tag === "VoidTExp";

// L52
export type AnyTExp = { tag: "AnyTExp" };
export const makeAnyTExp = (): AnyTExp => ({ tag: "AnyTExp"});
export const isAnyTExp = (x: any): x is AnyTExp => x.tag === "AnyTExp";

// L52
export type NeverTExp = { tag: "NeverTExp" };
export const makeNeverTExp = (): NeverTExp => ({ tag: "NeverTExp"});
export const isNeverTExp = (x: any): x is NeverTExp => x.tag === "NeverTExp";

// AVIAD: added PredExp
export type PredTExp = {tag: "PredTExp", type:TExp};
export const isPredTExp = (x: any): x is PredTExp => x.tag === "PredTExp";
export const makePredTExp = (pred: TExp): PredTExp => ({ tag: "PredTExp", type:pred});

// proc-te(param-tes: list(te), return-te: te)
export type ProcTExp = { tag: "ProcTExp"; paramTEs: TExp[]; returnTE: TExp; };
export const makeProcTExp = (paramTEs: TExp[], returnTE: TExp): ProcTExp =>
    ({tag: "ProcTExp", paramTEs: paramTEs, returnTE: returnTE});
export const isProcTExp = (x: any): x is ProcTExp => x.tag === "ProcTExp";
// Uniform access to all components of a ProcTExp
export const procTExpComponents = (pt: ProcTExp): TExp[] =>
    [...pt.paramTEs, pt.returnTE];

export type TupleTExp = NonEmptyTupleTExp | EmptyTupleTExp;
export const isTupleTExp = (x: any): x is TupleTExp =>
    isNonEmptyTupleTExp(x) || isEmptyTupleTExp(x);

export type EmptyTupleTExp = { tag: "EmptyTupleTExp" }
export const makeEmptyTupleTExp = (): EmptyTupleTExp => ({tag: "EmptyTupleTExp"});
export const isEmptyTupleTExp = (x: any): x is EmptyTupleTExp => x.tag === "EmptyTupleTExp";

// NonEmptyTupleTExp(TEs: NonTupleTExp[])
export type NonEmptyTupleTExp = { tag: "NonEmptyTupleTExp"; TEs: NonTupleTExp[]; }
export const makeNonEmptyTupleTExp = (tes: NonTupleTExp[]): NonEmptyTupleTExp =>
    ({tag: "NonEmptyTupleTExp", TEs: tes});
export const isNonEmptyTupleTExp = (x: any): x is NonEmptyTupleTExp => x.tag === "NonEmptyTupleTExp";


export type UnionTExp = { tag: "UnionTExp"; components: TExp[]};
export const makeUnionTExp = (tes: TExp[]): TExp =>
    normalizeUnion(({tag: "UnionTExp", components: flattenSortUnion(tes)}));
export const isUnionTExp = (x: any): x is UnionTExp => x.tag === "UnionTExp";

// L52
export type InterTExp = { tag: "InterTExp"; components: TExp[] };
export const makeInterTExp = (tes: TExp[]): TExp =>
    normalizeIntersection(({ tag: "InterTExp", components: flattenSortIntersection(tes) }));
export const isInterTExp = (x: any): x is InterTExp => x.tag === "InterTExp";

// In the value constructor - make sure the invariants are satisfied
// 1. All unions are flattened union(a, union(b, c)) => [a,b,c]
// 2. TExps are sorted by order of unparseTExp values

// L52
const flattenSortUnion = (tes: TExp[]): TExp[] =>
    removeDuplicatesAndNever(sort(subTypeComparator, flattenUnion(tes)));

// In case there is only one component - remove the union wrapper.
// (union) = never
const normalizeUnion = (ute: UnionTExp): TExp => {
    const normalized = isEmpty(ute.components) ? makeNeverTExp() : 
    includes(makeAnyTExp(), ute.components) ? makeAnyTExp() : 
    (ute.components.length === 1) ? ute.components[0] :
    ute;
    return dnf(normalized);
};
// Flatten all union components into the result
// and remove duplicates
// [number, union(number, string)] => [number, string]
const flattenUnion = (tes: TExp[]): TExp[] => 
    (tes.length > 0) ? 
        isUnionTExp(tes[0]) ? [...tes[0].components, ...flattenUnion(tes.slice(1))] :
        [tes[0], ...flattenUnion(tes.slice(1))] :
    [];

const flattenSortIntersection = (tes: TExp[]): TExp[] =>
    removeDuplicatesAndNever(sort(superTypeComparator, flattenIntersection(tes)));

const flattenIntersection = (tes: TExp[]): TExp[] =>
    (tes.length > 0) ? 
        isInterTExp(tes[0]) ? [...tes[0].components, ...flattenIntersection(tes.slice(1))] :
        [tes[0], ...flattenIntersection(tes.slice(1))] :
    [];

/*
    const normalizeIntersection = (ite: InterTExp): TExp => {
        const components = ite.components.filter(t => !isAnyTExp(t));
        if (components.length === 0) return makeAnyTExp();
        if (includes(makeNeverTExp(), components)) return makeNeverTExp();
        return components.length === 1 ? dnf(components[0]) : dnf(makeInterTExp(components));
    };
*/

    // OK
    const normalizeIntersection = (ite: InterTExp): TExp => {
        const flattened = flattenSortIntersection(ite.components);
    const normalized = isEmpty(ite.components) ? makeAnyTExp() : 
            includes(makeNeverTExp(), ite.components) ? makeNeverTExp() : 
                (ite.components.length === 1) ? ite.components[0] : 
                    ite;
    const withoutAny = flattened.filter(t => !isAnyTExp(t));
    
    // If the resulting list is empty, return `any`
    if (isEmpty(withoutAny)) {
        return makeAnyTExp();
        }
                
    // If the resulting list has only one component, return it directly
    if (withoutAny.length === 1) {
      return withoutAny[0];
    }
    return dnf(normalized);
    };

/*
const normalizeIntersection = (ite: InterTExp): TExp => {
    // Flatten and sort the components
    const flattened = flattenSortIntersection(ite.components);
    
    // If there are no components, the result is `any`
    if (isEmpty(flattened)) {
        return makeAnyTExp();
    }
    
    // If `never` is one of the components, the result is `never`
    if (includes(makeNeverTExp(), flattened)) {
        return makeNeverTExp();
    }
    
    // If `any` is one of the components, remove it
    const withoutAny = flattened.filter(t => !isAnyTExp(t));
    
    // If the resulting list is empty, return `any`
    if (isEmpty(withoutAny)) {
        return makeAnyTExp();
    }
    
    // If there is only one component, return it directly
    if (withoutAny.length === 1) {
        return withoutAny[0];
    }
    
    // Otherwise, return the normalized intersection
    return makeInterTExp(withoutAny);
};*/
// L52
/*
export const makeDiffTExp = (te1: TExp, te2: TExp): TExp => {
    const te1Prime = tvarDeref(te1);
    const te2Prime = tvarDeref(te2);
    // If te1 and te2 are the same, the difference is empty, represented by never.
    if (equals(te1Prime, te2Prime)) return makeNeverTExp();
    // If te1 is any, and te2 is also any, the difference is never.
    // If te1 is any, and te2 is not any, the difference is any.
    if (isAnyTExp(te1Prime)) return isAnyTExp(te2Prime) ? makeNeverTExp() : makeAnyTExp();
    // If te2 is never, the difference is just te1 because removing never has no effect.
    if (isNeverTExp(te2Prime)) return te1Prime;
    // If te1 is a union type, filter out components that are subtypes of te2 and return the resulting union.
    if (isUnionTExp(te1Prime)) return makeUnionTExp(te1Prime.components.filter(t => !isSubType(t, te2Prime)));
    // If te1 is an intersection type, filter out components that are subtypes of te2 and return the resulting intersection.
    if (isInterTExp(te1Prime)) return makeInterTExp(te1Prime.components.filter(t => !isSubType(t, te2Prime)));
    //If te2 is a union type, create an intersection of te1 and the difference of each component of te2 with te1.
    if (isUnionTExp(te2Prime)) return makeInterTExp([te1Prime, makeDiffTExp(te2Prime, te1Prime)]);
    //If te2 is an intersection type, create a union of the differences between te1 and each component of te2.
    if (isInterTExp(te2Prime)) return makeUnionTExp(te2Prime.components.map(t => makeDiffTExp(te1Prime, t)));

    return isSubType(te1Prime, te2Prime) ? makeNeverTExp() : te1Prime;
};
*/
export const makeDiffTExp = (te1: TExp, te2: TExp): TExp => {
    const te1Prime = tvarDeref(te1);
    const te2Prime = tvarDeref(te2);
    // If te1 and te2 are the same, the difference is empty, represented by never.
    if (equals(te1Prime, te2Prime)) return makeNeverTExp();
    // If te1 is any, and te2 is also any, the difference is never.
    // If te1 is any, and te2 is not any, the difference is any.
    if (isAnyTExp(te1Prime)) return isAnyTExp(te2Prime) ? makeNeverTExp() : makeAnyTExp();
    // If te2 is never, the difference is just te1 because removing never has no effect.
    if (isNeverTExp(te2Prime)) return te1Prime;
    if (isInterTExp(te2Prime)) {
        const intersectedTypes = te2Prime.components.map(tvarDeref);
        if (!intersectedTypes.includes(makeNeverTExp()) && hasNonSubtypePair(intersectedTypes)) {
            return te1Prime; // If te2 components are not subtypes of each other, return te1 immediately
        }
    }
    // If te1 is a union type, filter out components that are subtypes of te2 and return the resulting union.
    if (isUnionTExp(te1Prime)) return makeUnionTExp(te1Prime.components.filter(t => !isSubType(t, te2Prime)));
    // If te1 is an intersection type, filter out components that are subtypes of te2 and return the resulting intersection.
    if (isInterTExp(te1Prime)) return makeInterTExp(te1Prime.components.filter(t => !isSubType(t, te2Prime)));
    //If te2 is a union type, create an intersection of te1 and the difference of each component of te2 with te1.
    if (isUnionTExp(te2Prime)) return makeInterTExp([te1Prime, makeDiffTExp(te2Prime, te1Prime)]);
    //If te2 is an intersection type, create a union of the differences between te1 and each component of te2.
    if (isInterTExp(te2Prime)) return makeUnionTExp(te2Prime.components.map(t => makeDiffTExp(te1Prime, t)));

    return isSubType(te1Prime, te2Prime) ? makeNeverTExp() : te1Prime;
};

const hasNonSubtypePair = (components: TExp[]): boolean => {
    return components.some((t1, i) =>
        components.slice(i + 1).some(t2 =>
            !isSubType(t1, t2) && !isSubType(t2, t1)
        )
    );
};

export const equalsAtomicTExp = (te1: AtomicTExp, te2: AtomicTExp): boolean =>
    ((isNumTExp(te1) && isNumTExp(te2)) ||
     (isBoolTExp(te1) && isBoolTExp(te2)) ||
     (isStrTExp(te1) && isStrTExp(te2)) ||
     (isVoidTExp(te1) && isVoidTExp(te2)) ||
     (isAnyTExp(te1) && isAnyTExp(te2)) ||
     (isNeverTExp(te1) && isNeverTExp(te2)));
/*
const isSubTypeHelper = (te1: TExp, te2: TExp): boolean =>
    equals(te1, te2) ||
    isAnyTExp(te2) || // te1 is a subtype of te2 if te2 is `any`
    isNeverTExp(te1) || // `never` is a subtype of any type
    (isUnionTExp(te1) && all((t1: TExp) => isSubType(t1, te2), te1.components)) ||
    (isUnionTExp(te2) && isNonTupleTExp(te1) && any((t2: TExp) => isSubType(te1, t2), te2.components)) ||
    (isInterTExp(te1) && all((t1: TExp) => isSubType(t1, te2), te1.components)) ||
    (isInterTExp(te2) && isNonTupleTExp(te1) && any((t2: TExp) => isSubType(te1, t2), te2.components)) ||
    (isTVar(te1) && isTVar(te2) && eqTVar(te1, te2)) ||
    (isAtomicTExp(te1) && isAtomicTExp(te2) && equalsAtomicTExp(te1, te2)) ||
    (isProcTExp(te1) && isProcTExp(te2) && isSubTypeProc(te1, te2)) ||
    (isTupleTExp(te1) && isTupleTExp(te2) && isSubTypeTuple(te1, te2));
 */
    const isSubTypeHelper = (te1: TExp, te2: TExp): boolean => {
    
        //console.log('Checking subtype relationship:');
    //console.log('te1:', te1);
    //console.log('te2:', te2);

    const normalizedTe1 = isInterTExp(te1) ? normalizeIntersection(te1) : te1;
    const normalizedTe2 = isUnionTExp(te2) ? normalizeUnion(te2) : te2;

    //console.log('Normalized te1:', normalizedTe1);
    //console.log('Normalized te2:', normalizedTe2);
    
    
        return equals(normalizedTe1, normalizedTe2) ||
            isAnyTExp(normalizedTe2) || // te1 is a subtype of te2 if te2 is `any`
            isNeverTExp(normalizedTe1) || // `never` is a subtype of any type
            (isUnionTExp(normalizedTe1) && all((t1: TExp) => isSubType(t1, normalizedTe2), normalizedTe1.components)) ||
            (isUnionTExp(normalizedTe2) && isNonTupleTExp(normalizedTe1) && any((t2: TExp) => isSubType(normalizedTe1, t2), normalizedTe2.components)) ||
            (isInterTExp(normalizedTe1) && all((t1: TExp) => isSubType(t1, normalizedTe2), normalizedTe1.components)) ||
            (isInterTExp(normalizedTe2) && isNonTupleTExp(normalizedTe1) && any((t2: TExp) => isSubType(normalizedTe1, t2), normalizedTe2.components)) ||
            (isTVar(normalizedTe1) && isTVar(normalizedTe2) && eqTVar(normalizedTe1, normalizedTe2)) ||
            (isAtomicTExp(normalizedTe1) && isAtomicTExp(normalizedTe2) && equalsAtomicTExp(normalizedTe1, normalizedTe2)) ||
            (isProcTExp(normalizedTe1) && isProcTExp(normalizedTe2) && isSubTypeProc(normalizedTe1, normalizedTe2)) ||
            (isTupleTExp(normalizedTe1) && isTupleTExp(normalizedTe2) && isSubTypeTuple(normalizedTe1, normalizedTe2));
    };
const any = <T>(pred: (t: T) => boolean, arr: T[]): boolean => arr.some(pred);
const isSubTypeProc = (te1: ProcTExp, te2: ProcTExp): boolean =>
    (te1.paramTEs.length === te2.paramTEs.length) &&
    all((pair: [TExp, TExp]) => isSubType(pair[1], pair[0]), zip(te1.paramTEs, te2.paramTEs)) &&
    isSubType(te1.returnTE, te2.returnTE);

const isSubTypeTuple = (te1: TupleTExp, te2: TupleTExp): boolean =>
    (isEmptyTupleTExp(te1) && isEmptyTupleTExp(te2)) ||
    (isNonEmptyTupleTExp(te1) && isNonEmptyTupleTExp(te2) &&
     te1.TEs.length === te2.TEs.length &&
     all((pair: [TExp, TExp]) => isSubType(pair[0], pair[1]), zip(te1.TEs, te2.TEs)));
// Comparator for sort function - return -1 if te1 < te2, 0 if equal, +1 if te1 > te2
// If types not comparable by subType - order by lexicographic of unparsed form.
const subTypeComparator = (te1: TExp, te2: TExp): number =>
    equals(te1, te2) ? 0 :
    isSubType(te2, te1) ? 1 :
    isSubType(te1, te2) ? -1 :
    texpLexicoComparator(te1, te2);

// Comparator for sort function - return -1 if te1 < te2, 0 if equal, +1 if te1 > te2
// We fold the result into a number with either because we have a precondition that unparseTExp
// will always succeed.
const texpLexicoComparator = (te1: TExp, te2: TExp): number =>
    either(
        bind(unparseTExp(te1), (s1: string) =>
            bind(unparseTExp(te2), (s2: string) => makeOk(stringComparator(s1, s2)))),
        (res: number) => res,
        (_message: string) => 1);

const stringComparator = (s1: string, s2: string): number =>
    (s1 < s2) ? -1 :
    (s1 > s2) ? +1 :
    0;

// Remove duplicates (with isSubType comparator in containsType)
const removeDuplicatesAndNever = (tes: TExp[]): TExp[] =>
    isEmpty(tes) ? tes :
    containsType(tes.slice(1), tes[0]) ? removeDuplicatesAndNever(tes.slice(1)) :
    isNeverTExp(tes[0]) ? removeDuplicatesAndNever(tes.slice(1)) :
    [tes[0], ...removeDuplicatesAndNever(tes.slice(1))];
// L52 


 
// Comparator for sort function - return -1 if te1 > te2, 0 if equal, +1 if te1 < te2
// If the types are not comparable with subType, order by lexicographic form of unparsed.
const superTypeComparator = (te1: TExp, te2: TExp): number =>
    equals(te1, te2) ? 0 :
    isSubType(te1, te2) ? 1 :
    isSubType(te2, te1) ? -1 :
    texpLexicoComparator(te1, te2);

// Disjunctive normal form
// [a, union(c, d), union(e, f)]
// a.[(c+d).(e+f)] = [ace + acf + ade + adf]
// If TExp is an InterTExp - it is already normalized 
// (flat, no duplicates, sorted, no never, no any)
// If TExp is a UnionTExp - it is already normalized
export const dnf = (te: TExp): TExp => 
    isInterTExp(te) ? makeDnf(filter(isUnionTExp, te.components), 
                              filter((te) => ! isUnionTExp(te), te.components)) :
    te;

// (factors . Product(disj)) 
export const makeDnf = (disj: UnionTExp[], factors: TExp[]): TExp =>
    isEmpty(disj) && isEmpty(factors) ? makeAnyTExp() :
isEmpty(disj) ? ({tag: "InterTExp", components: factors}) : 
    factorDisj(disj, factors);

// Preconditions: disj is not empty, factors is not empty
// Compute Union(Product_i(disj_i) x factors)
// ((a+b), (c+d), (d+e+f)) x gh -> (ac + ad + bc + bd)x(d+e+f)xgh
export const factorDisj = (disj: UnionTExp[], factors: TExp[]): TExp =>
    makeUnionTExp(map(makeInterTExp, 
                      multiplyInter(factors, makeProduct(disj))));

                      // Preconditions: factors is not empty, products is not empty
// [a,b] * [[c,d], [e,f]] => [[a,b,c,d], [a,b,e,f]]
export const multiplyInter = (factors: TExp[], products: TExp[][]): TExp[][] =>
    map((product: TExp[]) => concat(product, factors), products);

// Preconditions: disj is not empty
// (a+b) => [[a], [b]]
// ((a+b)(c+d)) => [[a,c], [a,d], [b,c], [b,d]]
// (a+b)(c+d)(e+f+h) => (a+b)[(ce+cf+ch + de+df+dh)]
export const makeProduct = (disj: UnionTExp[]): TExp[][] =>
    (disj.length == 1) ? map((x)=>[x], disj[0].components) :
    crossProduct(makeProduct([disj[0]]), makeProduct(disj.slice(1)));

// [[a,b],[c,d]], [[e,f], [g,h]] => [[a,b,e,f], [a,b,g,h], [c,d,e,f], [c,d,g,h]]
export const crossProduct = (ll1: TExp[][], ll2: TExp[][]): TExp[][] =>
    map((l1: TExp[]) => 
         map((l2: TExp[]) => concat(l1, l2), ll2),
            ll1).flat();

// SubType comparator
/*
export const isSubType = (te1: TExp, te2: TExp): boolean =>
    (isUnionTExp(te1) && isUnionTExp(te2)) ? isSubset(te1.components, te2.components) :
    isUnionTExp(te2) ? containsType(te2.components, te1) :
    (isProcTExp(te1) && isProcTExp(te2)) ? checkProcTExps(te1, te2) :
    isTVar(te1) ? equals(te1, te2) :
    isAtomicTExp(te1) ? equals(te1, te2) :
    false;
*/
export const isSubType = (te1: TExp, te2: TExp): boolean => {
    const te1Prime = tvarDeref(te1);
    const te2Prime = tvarDeref(te2);
    return isSubTypeHelper(te1Prime, te2Prime);
};
// True when te is in tes or is a subtype of one of the elements of tes
export const containsType = (tes: TExp[], te: TExp): boolean =>
    isEmpty(tes) ? false :
    isSubType(te, tes[0]) ? true :
    containsType(tes.slice(1), te);

export const isSubset = (tes1: TExp[], tes2: TExp[]): boolean =>
    isEmpty(tes1) ? true :
    containsType(tes2, tes1[0]) ? isSubset(tes1.slice(1), tes2) :
    false;

// By contravariant definition (3.2.4)
// 1. te1 = ProcTExp(paramTEs: (p11...p1n1), returnTE: r1)
// 2. te2 = ProcTExp(paramTEs: (p21...p2n2), returnTE: r2)
// 3. n1 = n2
// 4. r1 ⊆ r2
// 5. ∀i ∈ [1 . . . n1], p2,i ⊆ p1,i (Note the inversion!)
export const checkProcTExps = (te1: ProcTExp, te2: ProcTExp): boolean => 
    (te1.paramTEs.length == te2.paramTEs.length) &&
    isSubType(te1.returnTE, te2.returnTE) &&
    all((pair: [TExp, TExp]) => isSubType(pair[0], pair[1]), zip(te2.paramTEs,te1.paramTEs));


// TVar: Type Variable with support for dereferencing (TVar -> TVar)
export type TVar = { tag: "TVar"; var: string; contents: Box<undefined | TExp>; };
export const isEmptyTVar = (x: any): x is TVar =>
    (x.tag === "TVar") && unbox(x.contents) === undefined;
export const makeTVar = (v: string): TVar =>
    ({tag: "TVar", var: v, contents: makeBox(undefined)});
const makeTVarGen = (): () => TVar => {
    let count: number = 0;
    return () => {
        count++;
        return makeTVar(`T_${count}`);
    }
}
export const makeFreshTVar = makeTVarGen();
export const isTVar = (x: any): x is TVar => x.tag === "TVar";
export const eqTVar = (tv1: TVar, tv2: TVar): boolean => tv1.var === tv2.var;
export const tvarContents = (tv: TVar): undefined | TExp => unbox(tv.contents);
export const tvarSetContents = (tv: TVar, val: TExp): void =>
    setBox(tv.contents, val);
export const tvarIsNonEmpty = (tv: TVar): boolean => tvarContents(tv) !== undefined;
export const tvarDeref = (te: TExp): TExp => {
    if (! isTVar(te)) return te;
    const contents = tvarContents(te);
    if (contents === undefined)
        return te;
    else if (isTVar(contents))
        return tvarDeref(contents);
    else
        return contents;
}

// ========================================================
// TExp Utilities

// Purpose: uniform access to atomic types
export const atomicTExpName = (te: AtomicTExp): string => te.tag;

export const eqAtomicTExp = (te1: AtomicTExp, te2: AtomicTExp): boolean =>
    atomicTExpName(te1) === atomicTExpName(te2);


// ========================================================
// TExp parser

export const parseTE = (t: string): Result<TExp> =>
    bind(p(t), parseTExp);

/*
;; Purpose: Parse a type expression
;; Type: [SExp -> TExp[]]
;; Example:
;; parseTExp("number") => 'num-te
;; parseTExp('boolean') => 'bool-te
;; parseTExp('T1') => '(tvar T1)
;; parseTExp('(T * T -> boolean)') => '(proc-te ((tvar T) (tvar T)) bool-te)
;; parseTExp('(number -> (number -> number)') => '(proc-te (num-te) (proc-te (num-te) num-te))
*/
export const parseTExp = (texp: Sexp): Result<TExp> =>
    (texp === "number") ? makeOk(makeNumTExp()) :
    (texp === "boolean") ? makeOk(makeBoolTExp()) :
    (texp === "void") ? makeOk(makeVoidTExp()) :
    (texp === "string") ? makeOk(makeStrTExp()) :
    // ?
    (texp === "any") ? makeOk(makeAnyTExp()) :
    (texp === "never") ? makeOk(makeNeverTExp()) :
    isString(texp) ? makeOk(makeTVar(texp)) :
    isArray(texp) ? parseCompoundTExp(texp) :
    makeFailure(`Unexpected TExp - ${format(texp)}`);

const parseCompoundTExp = (texps: Sexp[]): Result<TExp> =>
    (texps[0] === "union") ? parseUnionTExp(texps) :
    (texps[0] === "inter") ? parseInterTExp(texps) :
    (texps[0] === "is?") ? parsePredTExp(texps) : 
    parseProcTExp(texps);

// Expect (union texp1 ...)
const parseUnionTExp = (texps: Sexp[]): Result<TExp> =>
    mapv(mapResult(parseTExp, texps.slice(1)),
         (tes: TExp[]) => makeUnionTExp(tes));

// L52
const parseInterTExp = (texps: Sexp[]): Result<TExp> =>
    mapv(mapResult(parseTExp, texps.slice(1)),
         (tes: TExp[]) => makeInterTExp(tes));



/*
;; expected structure: (<params> -> <returnte>)
;; expected exactly one -> in the list
;; We do not accept (a -> b -> c) - must parenthesize
*/
const parseProcTExp = (texps: Sexp[]): Result<ProcTExp | PredTExp> => {
    const pos : number = texps.indexOf('->');
    return (pos === -1)  ? makeFailure(`Procedure type expression without -> - ${format(texps)}`) :
           (pos === 0) ? makeFailure(`No param types in proc texp - ${format(texps)}`) :
           (pos === texps.length - 1) ? makeFailure(`No return type in proc texp - ${format(texps)}`) :
           (texps.slice(pos + 1).indexOf('->') > -1) ? makeFailure(`Only one -> allowed in a procexp - ${format(texps)}`) :
           bind(parseTupleTExp(texps.slice(0, pos)), (args: TExp[]) =>
               mapv(parseTExp((pos + 2 === texps.length) ? texps[pos + 1] : texps.slice(pos+1)), (returnTE: TExp) =>
                    makeProcTExp(args, returnTE)))
};


const parsePredTExp = (texps: Sexp[]) : Result<TExp> => 
    (texps.length != 2) ? makeFailure("Error: incomptable number of arguments!") : 
    mapv(parseTExp(texps[1]), (t : TExp) => makePredTExp(t))



/*
;; Expected structure: <te1> [* <te2> ... * <ten>]?
;; Or: Empty
*/
const parseTupleTExp = (texps: Sexp[]): Result<TExp[]> => {
    const isEmptyTuple = (texps: Sexp[]): boolean =>
        (texps.length === 1) && (texps[0] === 'Empty');
    // [x1 * x2 * ... * xn] => [x1,...,xn]
    const splitEvenOdds = (texps: Sexp[]): Result<Sexp[]> =>
        isEmpty(texps) ? makeOk([]) :
        (texps.length === 1) ? makeOk(texps) :
        texps[1] !== '*' ? makeFailure(`Parameters of procedure type must be separated by '*': ${format(texps)}`) :
        mapv(splitEvenOdds(texps.slice(2)), (sexps: Sexp[]) => [texps[0], ...sexps]);

    return isEmptyTuple(texps) ? makeOk([]) : bind(splitEvenOdds(texps), (argTEs: Sexp[]) => 
                                                    mapResult(parseTExp, argTEs));
}

/*
;; Purpose: Unparse a type expression Texp into its concrete form
*/
export const unparseTExp = (te: TExp): Result<string> => {
    const unparseTuple = (paramTes: TExp[]): Result<string[]> =>
        isNonEmptyList<TExp>(paramTes) ? bind(unparseTExp(first(paramTes)), (paramTE: string) =>
            mapv(mapResult(unparseTExp, rest(paramTes)), (paramTEs: string[]) =>
                cons(paramTE, chain(te => ['*', te], paramTEs)))) :
        makeOk(["Empty"]);

    const parenthesizeUnion = (tes: string[]): string =>
        (tes.length == 1) ? tes[0] :  // (union T) -> T
        `(union ${tes[0]} ${parenthesizeUnion(tes.slice(1))})`

    const up = (x?: TExp): Result<string | string[]> =>
        isNumTExp(x) ? makeOk('number') :
        isBoolTExp(x) ? makeOk('boolean') :
        isStrTExp(x) ? makeOk('string') :
        isVoidTExp(x) ? makeOk('void') :
        isAnyTExp(x) ? makeOk('any') :
        isNeverTExp(x) ? makeOk('never') :
        isEmptyTVar(x) ? makeOk(x.var) :
        isTVar(x) ? up(tvarContents(x)) :
        isUnionTExp(x) ? mapv(mapResult(unparseTExp, x.components), (componentTEs: string[]) => 
                                parenthesizeUnion(componentTEs)) :
        // L52
        isInterTExp(x) ? mapv(mapResult(unparseTExp, x.components), (componentTEs: string[]) =>
                                `(inter ${componentTEs.join(' ')})`) :
        isProcTExp(x) ? bind(unparseTuple(x.paramTEs), (paramTEs: string[]) =>
                            mapv(unparseTExp(x.returnTE), (returnTE: string) =>
                                [...paramTEs, '->', returnTE])) :
        isEmptyTupleTExp(x) ? makeOk("Empty") :
        isNonEmptyTupleTExp(x) ? unparseTuple(x.TEs) :
        x === undefined ? makeFailure("Undefined TVar") :
        isPredTExp(x) ? mapv(unparseTExp(x.type), (s2: string) =>'is?' + s2) :
        x;

    const unparsed = up(te);
    return mapv(unparsed,
                (x: string | string[]) => isString(x) ? x :
                                          isArray(x) ? `(${x.join(' ')})` :
                                          x);
}

// No need to change this for Union
// ============================================================
// equivalentTEs: 2 TEs are equivalent up to variable renaming.
// For example:
// equivalentTEs(parseTExp('(T1 -> T2)'), parseTExp('(T3 -> T4)'))


// Signature: matchTVarsInTE(te1, te2, succ, fail)
// Type: [Texp * Texp * [List(Pair(Tvar, Tvar)) -> T1] * [Empty -> T2]] |
//       [List(Texp) * List(Texp) * ...]
// Purpose:   Receives two type expressions or list(texps) plus continuation procedures
//            and, in case they are equivalent, pass a mapping between
//            type variable they include to succ. Otherwise, invoke fail.
// Examples:
// matchTVarsInTE(parseTExp('(Number * T1 -> T1)',
//                parseTExp('(Number * T7 -> T5)'),
//                (x) => x,
//                () => false) ==> [[T1, T7], [T1, T5]]
// matchTVarsInTE(parseTExp('(Boolean * T1 -> T1)'),
//                parseTExp('(Number * T7 -> T5)'),
//                (x) => x,
//                () => false)) ==> false

type Pair<T1, T2> = {left: T1; right: T2};

const matchTVarsInTE = <T1, T2>(te1: TExp, te2: TExp,
                                succ: (mapping: Array<Pair<TVar, TVar>>) => T1,
                                fail: () => T2): T1 | T2 =>
    (isTVar(te1) || isTVar(te2)) ? matchTVarsinTVars(tvarDeref(te1), tvarDeref(te2), succ, fail) :
    (isAtomicTExp(te1) || isAtomicTExp(te2)) ?
        ((isAtomicTExp(te1) && isAtomicTExp(te2) && eqAtomicTExp(te1, te2)) ? succ([]) : fail()) :
    matchTVarsInTProcs(te1, te2, succ, fail);

// te1 and te2 are the result of tvarDeref
const matchTVarsinTVars = <T1, T2>(te1: TExp, te2: TExp,
                                    succ: (mapping: Array<Pair<TVar, TVar>>) => T1,
                                    fail: () => T2): T1 | T2 =>
    (isTVar(te1) && isTVar(te2)) ? (eqTVar(te1, te2) ? succ([]) : succ([{left: te1, right: te2}])) :
    (isTVar(te1) || isTVar(te2)) ? fail() :
    matchTVarsInTE(te1, te2, succ, fail);

const matchTVarsInTProcs = <T1, T2>(te1: TExp, te2: TExp,
        succ: (mapping: Array<Pair<TVar, TVar>>) => T1,
        fail: () => T2): T1 | T2 =>
    (isProcTExp(te1) && isProcTExp(te2)) ? matchTVarsInTEs(procTExpComponents(te1), procTExpComponents(te2), succ, fail) :
    fail();

const matchTVarsInTEs = <T1, T2>(te1: TExp[], te2: TExp[],
                                    succ: (mapping: Array<Pair<TVar, TVar>>) => T1,
                                    fail: () => T2): T1 | T2 =>
    // Match first then continue on rest
    isNonEmptyList<TExp>(te1) && isNonEmptyList<TExp>(te2) ?
        matchTVarsInTE(first(te1), first(te2),
                        (subFirst) => matchTVarsInTEs(rest(te1), rest(te2), 
                                        (subRest) => succ(concat(subFirst, subRest)), 
                                        fail),
                        fail) :
    (isEmpty(te1) && isEmpty(te2)) ? succ([]) :
    fail();

// Signature: equivalent-tes?(te1, te2)
// Purpose:   Check whether 2 type expressions are equivalent up to
//            type variable renaming.
// Example:  equivalentTEs(parseTExp('(T1 * (Number -> T2) -> T3))',
//                         parseTExp('(T4 * (Number -> T5) -> T6))') => #t
export const equivalentTEs = (te1: TExp, te2: TExp): boolean => {
    // console.log(`EqTEs ${format(te1)} - ${format(te2)}`);
    const tvarsPairs = matchTVarsInTE(te1, te2, (x) => x, () => false);
    // console.log(`EqTEs pairs = ${map(JSON.stringify, tvarsPairs)}`)
    if (isBoolean(tvarsPairs))
        return false;
    else {
        return (uniq(map((p) => p.left.var, tvarsPairs)).length === uniq(map((p) => p.right.var, tvarsPairs)).length);
    }
};
