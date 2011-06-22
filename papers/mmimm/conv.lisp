;;; convert a mathematical expression into a mbrola file

(defvar *words* '())

; the phonemes are a list of strings and timings
(defun add-word! (symb phonemes)
  (push (cons symb phonemes) *words*))
(defun get-word (word)
  (cdr (assoc word *words*)))

(add-word! 'a '(("EI" 160)))
(add-word! 'x '(("E" 100)
	       ("k" 40)
	       ("s" 60)))
(add-word! 'b '(("b" 40)
	       ("i" 160)))
(add-word! '1 '(("w" 60)
	       ("V" 90)
	       ("n" 70)))
(add-word! '2 '(("t" 40)
		("u" 210)))
(add-word! 'plus '(("p" 40)
		  ("l" 60)
		  ("V" 80)
		  ("s" 80)))
(add-word! 'times '(("t" 20)
		    ("AI" 70)
		    ("m" 70)
		    ("z" 80)))
(add-word! 'over '(("@U" 80)
		  ("v" 60)
		  ("r=" 100)))
(add-word! 'half '(("h" 40)
		   ("{" 80)
		   ("f" 80)))
(add-word! 'one-half '(("w" 40)
		      ("V" 75)
		      ("n" 50)
		      ("h" 40)
		      ("{" 80)
		      ("f" 80)))
(add-word! '_ '(("_" 120)))

(defun pause (time)
  (format '() "_ ~a~%" time))

;; a phoneme is a list of phoneme/timing pairs
(defun phoneme-utterance (phonemes)
  (list 'phoneme-utterance phonemes))
;; pitches are a list of percentage through/SD from mean pairs
(defun utterance-utterance (utterances pitches)
  (list 'utterance-utterance utterances pitches))

(defun rendered-utterance-length (rutt)
  (apply #'+ (mapcar #'cadr (car rutt))))

(defun lin-val (x disps)
  (let ((before (remove-if-not #'(lambda (a)
				   (<= (car a) x))
			       disps))
	(after (remove-if-not #'(lambda (a)
				  (>= (car a) x))
			      disps)))
    (cond ((null before)
	   (cadar after))
	  ((null after)
	   (cadar (last before)))
	  ((= x (caar after)) (cadar after))
	  (t (let ((x1 (car (last before)))
		   (x2 (car after)))
	       (+ (cadr x1)
		  (* (- x (car x1))
		     (/ (- (cadr x2)
			   (cadr x1))
			(- (car x2)
			   (car x1))))))))))

(defvar *pause* 1)
(defvar *minimum-pause* 1)

(defun utter-relative-pause (a)
    (if (< a *minimum-pause*)
	(setf *minimum-pause* a))
    (list 'relative-pause a))

; given perc-displacements and the length through which they act, add
; the function to time-displacements (a list of time/SD pairs)
(defun pitch-combine (len perc-displacements time-displacements)
  (let ((disp (mapcar #'(lambda (d)
			  (list (/ (* (car d) len) 100)
				(cadr d)))
		      perc-displacements)))
    (let ((displaced
	   (loop for td in time-displacements
	      collect (list (car td)
			    (+ (cadr td)
			       (lin-val (car td)
					disp))))))
      (sort
       (append displaced
	       (loop for td in (remove-if
				#'(lambda (a)
				    (assoc (car a) displaced))
				disp)
		  collect (list (car td)
				(+ (cadr td)
				   (lin-val (car td)
					    time-displacements)))))
       #'(lambda (a b)
	   (<= (car a) (car b)))))))
				 
;; take utterance and output data structure which can be rendered by
;; render-phonemes
(defun render-utterance (utterance)
  (case (car utterance)

    ((relative-pause)
     (list (list (list "_" (floor (* 80 (/ (cadr utterance)
					   *minimum-pause*)))))
	   '()))

    ((phoneme-utterance)
     (list (cadr utterance)
	   (list '(0 0)
		 (list (- (apply #'+ (mapcar #'cadr (cadr utterance))) 1)
		       0))))

    ((utterance-utterance)
     (let* ((utterances (mapcar #'render-utterance (cadr utterance)))
	    (lengths (mapcar #'rendered-utterance-length utterances)))
       (list (apply #'append (mapcar #'car utterances))
	     (pitch-combine
	      (apply #'+ lengths) (caddr utterance)
	      (apply #'append
		     (loop
			for u in utterances
			for l in lengths
			summing l into cum-len
			collect (mapcar #'(lambda (p)
					    (list (- (+ cum-len (car p))
						     l)
						  (cadr p)))
					(cadr u))))))))))

;; takes data structure from render-utterance and outputs mbrola
(defun render-phonemes (rend-utt mean sd)
  (setf *minimum-pause* *pause*)
  (format '() "~{~a~%~}"
	  (loop for phon in (car rend-utt)
	     summing (cadr phon) into loc
	     collect (let* ((len (cadr phon))
			    (i (- loc len)))
		       (format '() "~a ~a~{~a~}"
			       (car phon)
			       (cadr phon)
			       (mapcar
				#'(lambda (tim)
				    (format '()
					    " ~a ~a"
					    (floor (* 100 (/ (- (car tim) i) len)))
					    (floor (+ mean (* sd (cadr tim))))))
				(remove-if-not
				 #'(lambda (tim)
				     (and (>= (car tim) i)
					  (<= (car tim) loc)))
				 (cadr rend-utt))))))))

(defun utter-words (&rest words)
  (utterance-utterance (mapcar #'(lambda (w) (phoneme-utterance (get-word w)))
			       words)
		       '((0 0))))

(defun utter-math (expr)
  (let ((*pause* (/ *pause* 2)))
    (cond
      ((atom expr)
       (phoneme-utterance (get-word expr)))
      
      ((equal '(/ 1 2) expr)
       (phoneme-utterance (get-word 'one-half)))
      
      ((eq '+ (car expr))
       (utter-oper (cdr expr) 'plus))
      
      ((eq '* (car expr))
       (utter-oper (cdr expr) 'times))
      
      ((eq '/ (car expr))
       (utter-oper (cdr expr) 'over)))))

(defun utter-oper (addends oper)
  (if (= 1 (length addends))
      (utterance-utterance
       (list (utter-math (car addends)))
       '((0 0) (99 -2)))

      (utterance-utterance
       (list
	(utterance-utterance
	 (list (utter-math (car addends)))
	 (if (= 2 (length addends))
	     '((0 0) (30 0) (60 -1) (99 3))
	     '((0 0) (50 1) (99 3))))
	(utterance-utterance
	 (list (utter-relative-pause *pause*) (utter-words oper))
	 '((0 2) (80 2) (99 4)))
	(utter-oper (cdr addends) oper))
       '((0 0) (99 0)))))

(let ((out (open "~conv.pho" :direction :output :if-exists :supersede)))
  (let ((str (render-phonemes
	      (render-utterance
;	       (utter-math '(* (+ x 1) (+ a 2)))
;	       (utter-math '(+ (* 2 x) b))
	       (utter-math '(+ (/ 1 2) x))
	       )
	      240 20)))
    (format t "~a" str)
    (format out "~a" str)
    (format out "~a" (pause 120)))
  (close out))

(sb-ext:run-program "/home/kmill/mbrola/mbrola-linux-i386"
		    '("/home/kmill/mbrola/us1/us1"
		      "~conv.pho"
		      "~conv.wav"))
(sb-ext:run-program "/usr/bin/mplayer"
		    '("~conv.wav"))