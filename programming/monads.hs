---
--- monads.hs --- an introduction to monads!
--- An Introduction to Haskell, IAP 2010, Kyle Miller
--- Modified December 2011
---
import IO -- (<-- we'll talk about this later)
import Monad -- (<-- contains a function called 'guard')

-- Before we get into monads, let's first look at some problems we
-- might want to solve, and see if we can simplify what we're doing
-- (hint: it's going to involve discovering monads).

----- Problem 1:
-- Let's say we want to tag data so we know where it came from, but we
-- also want to apply functions on the data, keeping the provenance
-- intact.

data TaggedDataType x = TaggedData { creator :: String, innerData :: x }
                        deriving Show

-- So, if we want to create tagged data, we invoke the constructor:
ex1 = TaggedData "I made this." (2 + 3)
-- and then get the data out:
ex2 = do putStr "Stuff in ex1."
         putStr (" creator=" ++ show (creator ex1))
         putStrLn (" innerData=" ++ show (innerData ex1))

-- Now, let's say we want to make a function which takes an integer
-- TaggedDataType and adds 5 to it, keeping creator the same.
taggedAddFive :: TaggedDataType Integer -> TaggedDataType Integer
taggedAddFive x = TaggedData ((creator x) ++ " Then added 5.") (5 + (innerData x))

-- More complicated, let's say we want to make a function which then
-- doubles the tagged value after adding five to it
taggedAddFiveDoub :: TaggedDataType Integer -> TaggedDataType Integer
taggedAddFiveDoub x = let x2 = taggedAddFive x
                      in TaggedData ((creator x2) ++ " Then doubled.") (2 * (innerData x2))

-- We can do better.  Let's make a new function, let's call it
-- "bindTagged" because it binds the inside of a TaggedDataType as an
-- argument to a function, keeping the creator intact (it's like
-- making "pipework"):
bindTagged :: TaggedDataType x -> (x -> TaggedDataType y) -> TaggedDataType y
taggedValue `bindTagged` f = let x2 = f (innerData taggedValue)
                             in TaggedData ((creator taggedValue) ++ (creator x2)) (innerData x2)

-- We can rewrite our previous two functions:
taggedAddFive2 :: TaggedDataType Integer -> TaggedDataType Integer
taggedAddFive2 x = x `bindTagged`
                   (\v -> TaggedData " Then added 5." (v + 5))
taggedAddFiveDoub2 x = (taggedAddFive2 x) `bindTagged`
                       (\v -> TaggedData " Then doubled." (v * 2))

-- (not that bad, but we'll do better later)

----- Problem 2
-- Let's say we are doing computations, but we might run into an
-- error!  For example, perhaps we have associated lists of type
-- [(Integer, String)] and we want to search for a string given an
-- integer.
assocSearch :: Integer -> [(Integer, String)] -> String
assocSearch key ((i,s):xs) = if key == i
                             then s
                             else assocSearch key xs
-- but what if key never appears?  We could return a sentinel such as
-- "", but perhaps we want to have associated lists which contain "".
-- We can create a new datatype.  Let's call it Perhaps to reflect
-- the idea of perhaps having a value.
data Perhaps x = Yep x | Nope
                 deriving Show
-- so if we are searching for 5, and we find (5,"a"), we return Yep
-- "a", otherwise Nope.
assocSearch2 :: Integer -> [(Integer, String)] -> Perhaps String
assocSearch2 key ((i,s):xs) = if key == i
                              then Yep s
                              else assocSearch2 key xs
assocSearch2 _ [] = Nope

-- We can use this like (the argument to ex3 is an integer)
ex3 k = let al = [(1,"a"), (2,"b"), (3,"c")]
        in case (assocSearch2 k al) of
             Nope -> "Didn't find that key"
             Yep x -> "Found " ++ x
-- ex3 1 ==> "Found a"
-- ex3 5 ==> "Didn't find that key"

-- Let's say we also have a function which adds "good" to the end of a
-- string only if it's not an "a", otherwise it's an error (who
-- knows--perhaps it could be useful)
not_a :: String -> Perhaps String
not_a s | s == "a"   = Nope
        | otherwise  = Yep (s ++ "good")

-- For whatever reason, we've decided it's necessary to take the
-- output of assocSearch2 and run it through not_a
ex4 k = let al = [(1,"a"), (2,"b"), (3,"c")]
        in case (assocSearch2 k al) of
             Nope -> "Didn't find that key"
             Yep x -> case (not_a x) of
                        Nope -> "Boo. It was an a."
                        Yep s -> "Found "++s
-- ex4 2 => "Found bgood"
-- ex4 1 => "Boo. It was an a."

-- But, this is still a bit ugly.  We have to keep nesting these case
-- statements!  Let's make a helper function called bindPerhaps which
-- binds the inside value of a Perhaps to a function only if it is not
-- a Nope, otherwise it just passes on Nope.
bindPerhaps :: Perhaps x -> (x -> Perhaps y) -> Perhaps y
v `bindPerhaps` f = case v of
                      Nope -> Nope
                      Yep x -> f x

-- Then, we can rewrite our function:
ex5 x = let ret = (assocSearch2 x al) `bindPerhaps` not_a
        in case ret of
             Nope -> "Didn't find key, or we got an 'a'!"
             Yep s -> "Found " ++ s
            where al = [(1,"a"), (2,"b"), (3,"c")]
-- ex5 2 => "Found bgood"
-- ex5 10 => "Didn't find key, or we got an 'a'!"
-- ex5 1 => "Didn't find key, or we got an 'a'!"

-- That looks a bit better.

----- Problem 3
-- Sometimes we want to handle multiple values from a function, such
-- as a square root (the positive and negative roots).  One way we can
-- handle this is with a list:

multiSqrt x | x > 0   = [ -(sqrt x), sqrt x ]
            | x == 0  = [ 0 ]

-- Let's say we want to pass the output of this to a function f:
ex6 = let f x = 5 + x
      in map f (multiSqrt 4)
-- But, what if f, too, wants to use the multiSqrt function?
ex7 = let f x = multiSqrt (10 + x)
      in concat (map f (multiSqrt 4))
-- Again, we can do better.  Let's define bindMulti to take a
-- function and apply it to every element of a list
bindMulti :: [x] -> (x -> [y]) -> [y]
bindMulti vals f = concat (map f vals)
-- So, we write
ex8 = let f x = multiSqrt (10 + x)
      in (multiSqrt 4) `bindMulti` f
-- We only have to write `bindMulti` instead of concat & map.

-----
----- Did somebody say monads?
-----
-- Let's look at the type signatures of our bind operators.
-- bindTagged :: TaggedDataType x -> (x -> TaggedDataType y) -> TaggedDataType y
-- bindPerhaps :: Perhaps x -> (x -> Perhaps y) -> Perhaps y
-- bindMulti :: [x] -> (x -> [y]) -> [y]

-- Here's the secret: a monad is just something which has such a
-- binding operator (and one other thing).  The thing we haven't
-- directly talked about is converting a value into such a monad.  We
-- call such an operator return.  For example:
returnTagged x = TaggedData "" x
returnPerhaps x = Yep x
returnMulti x = [x]

-- Note that ((returnXXX a) `bindXXX` f) is the same as (f a)

-- To generalize this behavior, Haskell has a Monad class.
-- class Monad m where
--     (>>=)  ...
--     return ...

-- So, let's turn our objects into Monads.
instance Monad TaggedDataType where
    (>>=)  = bindTagged
    return = returnTagged

instance Monad Perhaps where
    (>>=)  = bindPerhaps
    return = returnPerhaps

-- In fact, there already is a monad with the functionality of
-- Perhaps, and that's
-- data Maybe x = Just x | Nothing

-- And, it turns out lists are already instances of class Monad.

-- Haskell provides a nice syntax to aid in writing expressions using
-- the contents of monads.  Instead of writing
taggedAddFive3 x = x >>= (\v -> TaggedData " Then added 5." (v + 5))
taggedAddFiveDoub3 x = (taggedAddFive3 x) >>= (\v -> TaggedData " Then doubled." (v * 2))
-- which is called like (taggedAddFiveDoub3 (return 2))
-- we can write, as shorthand,
taggedAddFiveDoub4 x = do v <- taggedAddFive3 x
                          TaggedData " Then doubled." (v*2)
-- the last expression in a 'do' statement is the return value, which
-- must be of the same type as the first expression.

-- Likewise, instead of writing
ex9 x = (assocSearch2 x al) >>= not_a
    where al = [(1,"a"), (2,"b"), (3,"c")]
-- you could instead choose to name intermediate expressions
ex10 x = do search <- assocSearch2 x al
            ret <- not_a search
            return ret
    where al = [(1,"a"), (2,"b"), (3,"c")]

-- and,
ex11 = let f x = multiSqrt (10 + x)
       in do v1 <- (multiSqrt 4)
             f v1

-- For an awesome example of the list monad letting you deal with
-- multiple values,
pyth_triples = do x <- [1..100]
                  y <- [1..100]
                  z <- [1..1000]
                  guard (x^2 + y^2 == z^2)  -- 'guard' requires the Monad module
                  return (x,y,z)
-- For the list monad, this is equivalent to writing
pyth_triples2 = [(x,y,z) | x <- [1..100], y <- [1..100], z <- [1..1000], x^2 + y^2 == z^2]

----- IO
-- One of the things which Monads let us do is order expressions.
-- Since IO has side effects, the order in which IO operations execute
-- needs to be explicitly ordered.  The IO monad keeps track of the
-- state of IO devices.  One constraint with using IO is that, if a
-- value of type X was calculated when using IO, it must in the end be
-- of type IO X

-- Let's make a function which asks for your name, prints it, and
-- returns it.

getName :: IO String
getName = do putStr "What is your name? "
             x <- getLine
             putStrLn ("Hello, " ++ x)
             return x

-- Executing getName in ghci:
--- *Main> getName
--- What is your name? Kyle
--- Hello, Kyle
--- "Kyle"
-- The final line is the return value.  ghci can handle values of type
-- IO String.

-- Let's say you want to make a function which then takes someone's
-- name, and tells a little story based on the argument.

-- This is an error:
--- doStory x = (getName) ++ " walked to the store to get some " ++ x ++ "."
-- since getName returns an IO String, not a String.  Instead,
doStory x = do name <- getName
               return $ name ++ " walked to the store to get some " ++ x ++ "."
-- since bind takes the IO String from 'getName' and puts the String
-- in 'name'
--- *Main> doStory "OJ"
--- What is your name? Kyle
--- Hello, Kyle
--- "Kyle walked to the store to get some OJ."
-- note that the type of doStory is String -> IO String

--- An aside:
-- When dealing with IO on the terminal, the output to stdout may not
-- have caught up when there's a request for stdin (due to the output
-- buffer).  One solution is to call "hFlush stdout".  Otherwise, you
-- may choose to alter the buffering for stdout by writing
-- "hSetBuffering stdout NoBuffering".  Of course, these return a
-- value of type IO ().