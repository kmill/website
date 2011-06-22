#!/usr/bin/python
from PIL import Image
import sys

infile = sys.argv[1]
outfile = sys.argv[2]

inp = Image.open(infile)
pixels = inp.load()

width, height = inp.size

colweights = [ sum([pixels[col, row][0] for row in xrange(0, height)]) for col in xrange(0, width)]

maxweight = max(colweights)/255.0

last = 0.5
loc = 0.5
veloc = 0.0

for col in xrange(0, width) :
    avg = 0.0
    moment = 0.0
    for row in xrange(0, height) :
        avg += pixels[col, row][0]/255.0
        moment += (pixels[col, row][0] * row)/(255.0 * height)
        pixels[col, row] = (0, 0, 0)
    if avg == 0.0 :
        print "---"
    else :
#        print moment/avg
        last = avg/maxweight * (moment/avg) + (1-avg/maxweight) * last
        veloc += (last-loc)*0.1 - 0.5*veloc
        loc = loc + veloc
        loc = max(0.0, min(1.0, loc))
#        last = moment/avg
        r = int(height*loc)
        v = int(255.0*avg/maxweight)
#        pixels[col, int(height*last)] = (0, 255, 0)
        pixels[col, r] = (v, v, v)

inp.save(outfile)
