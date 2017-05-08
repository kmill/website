# solve the coins problem by series.  (in Python 3)
#
# The coin problem is: given a list of distinct coin denominations,
# how many ways are there to dispense a particular amount of change?
# Two variations are (1) give the number of ways for a particular
# amount, or (2) give the number of ways for all amounts up to a
# particular amount.  With series, we get (2) automatically.

def series_from_poly(p):
    """Takes a polynomial (a list of coefficients, least to greatest
    power) and returns a series representation (an infinite generator
    of coefficients)."""
    yield from p
    while True:
        yield 0

def pdivide(f, g) :
    """f is a generator of series coefficients.  g is a polynomial."""

    g = list(g)
    r = [next(f) for i in range(len(g)-1)]
    r.append(0) # this is the location "bringing down" the next term of f goes

    for fj in f:
        r[len(r)-1] = fj
        q0 = r[0]//g[0]
        #assert r[0]-q0*g[0] == 0 # we know all terms _must_ be integers for this problem
        yield q0
        # now do r[0:-2] = r[1:] - q0*g[1:].
        # (note r[0]-q0*g[0] == 0, and gets dropped off front of remainder)
        for i in range(len(g)-1):
            r[i] = r[i+1]-q0*g[i+1]

def take(n, f):
    """Gives an nth order polynomial approximation of the series f."""
    from itertools import islice
    return list(islice(f, 0, n+1))

# for testing pdivide
def geom_series(a):
    """return 1/(1-ax)"""
    return pdivide(series_from_poly([1]), [1,-a])

# for testing pdivide
def geom_series_pow(a,n):
    """return 1/(1-ax^n)"""
    g = [1]+[0]*(n-1)+[-a]
    return pdivide(series_from_poly([1]), g)

# for testing pdivide
def fib_series():
    return pdivide(series_from_poly([1]), [1,-1,-1])

def coin_series(coins):
    """Coins is a list of denominations.  Returns the generating function
    for the number of ways to dispense a particular amount of change.
    1/(1-x^d1) * 1/(1-x^d2) * ... * 1/(1-x^dn)."""

    if not coins:
        return series_from_poly([1])
    else:
        d = coins[0]
        return pdivide(coin_series(coins[1:]), [1]+[0]*(d-1)+[-1])

def dispense(coins, amount):
    """Returns the number of ways to dispense a certain amount given a
    list of allowed denominations."""
    from itertools import islice
    return next(islice(coin_series(coins), amount, None))

# Examples:
# >>> take(100, coin_series([1,5,10,25,50]))
# >>> dispense([1,2,3,5,8], 22)
# >>> take(100, fib_series())

# Extensions and discussion:
#
# 1. What is the least amount so that it and every larger amount can
# be dispensed with the given coins? For example with coins=[5,7],
# every amount >= 24 has at least one way.
#
# 2. In a way, the polynomial long division has turned a recursive
# algorithm into a dynamic program with a constant amount of
# memoization, keeping track of d1*d2*...*dn state.  (Compare to
# fib_series which keeps track of two numbers.)  How does this
# series-based algorithm compare to other dynamic programming
# solutions?
#
# 3. It is possible to calculate a particular Fibonacci number in
# logarithmic time by doing fast exponentiation of the transition
# matrix [[0,1],[1,1]].  Does the coin dispensing problem admit a
# similar speedup? (My guess on worst case: it gives running time
# O(log(n)*matmul(m)), where n is the amount, m=d1*d2*...*dk, and
# matmul(m) is the running time for multiplying two mxm matrices.)
#
# 4. Can generating functions be used to find the way which takes the
# _least_ number of coins?
