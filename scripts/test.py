
def diff(PPQ, timesig, start, end):
    k = PPQ*timesig
    C = 60000*timesig/(end-start)

    def generate():
        return map(lambda x: 1.0/(start*k/(end-start) + x), range(0, k))

    return C * sum(list(generate()))

print(diff(24, 4, 60, 120))

